package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// OrderReport aggregates order analytics for a date range.
//
// Implementation note: the queries use the Asia/Dhaka timezone for date
// bucketing so seller-facing ranges match how the seller interprets
// "today" / "this week" in their local context.
func (r *analyticsRepo) OrderReport(ctx context.Context, shopID string, from, to time.Time) (*domain.OrderReport, error) {
	rep := &domain.OrderReport{
		From:             from,
		To:               to,
		StatusCounts:     map[string]int{},
		StatusRevenueBDT: map[string]string{},
	}

	// 1. Headline aggregate — total/non-cancelled revenue, gross, AOV.
	err := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)                                                                                AS total_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status NOT IN ('cancelled')), 0)::numeric(14,2)::text AS net_revenue,
			COALESCE(SUM(total_bdt), 0)::numeric(14,2)::text                                        AS gross_sales,
			COALESCE(AVG(total_bdt) FILTER (WHERE status NOT IN ('cancelled')), 0)::numeric(14,2)::text AS aov
		FROM orders
		WHERE shop_id = $1
		  AND (created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	).Scan(&rep.TotalOrders, &rep.TotalRevenueBDT, &rep.GrossSalesBDT, &rep.AOVBDT)
	if err != nil {
		return nil, fmt.Errorf("order report headline: %w", err)
	}

	// 2. Status breakdown.
	rows, err := r.db.QueryContext(ctx, `
		SELECT status, COUNT(*), COALESCE(SUM(total_bdt), 0)::text
		FROM orders
		WHERE shop_id = $1
		  AND (created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
		GROUP BY status`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	)
	if err != nil {
		return nil, fmt.Errorf("order report status: %w", err)
	}
	for rows.Next() {
		var s, rev string
		var n int
		if err := rows.Scan(&s, &n, &rev); err != nil {
			rows.Close()
			return nil, fmt.Errorf("order report status scan: %w", err)
		}
		rep.StatusCounts[s] = n
		rep.StatusRevenueBDT[s] = rev
	}
	rows.Close()

	// 3. Daily series — reuses the existing helper to avoid SQL duplication.
	daily, err := r.RangeStats(ctx, shopID, from, to)
	if err != nil {
		return nil, err
	}
	rep.Daily = daily
	for _, d := range daily {
		var cur, peak float64
		fmt.Sscanf(d.RevenueBDT, "%f", &cur)
		fmt.Sscanf(rep.PeakDay.RevenueBDT, "%f", &peak)
		if cur > peak {
			rep.PeakDay = d
		}
	}

	// 4. Top products in window (by quantity sold, ignoring cancelled).
	rows, err = r.db.QueryContext(ctx, `
		SELECT
			oi.product_id,
			oi.product_name_snapshot,
			SUM(oi.quantity)::int        AS qty,
			SUM(oi.line_total_bdt)::text AS revenue
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.shop_id = $1
		  AND o.status NOT IN ('cancelled')
		  AND (o.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY qty DESC
		LIMIT 10`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	)
	if err != nil {
		return nil, fmt.Errorf("order report top products: %w", err)
	}
	for rows.Next() {
		var tp domain.TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQuantity, &tp.TotalRevenueBDT); err != nil {
			rows.Close()
			return nil, fmt.Errorf("order report top products scan: %w", err)
		}
		rep.TopProducts = append(rep.TopProducts, tp)
	}
	rows.Close()

	// 5. Customer trends — unique buyers, repeat buyers, top spenders, new buyers.
	err = r.db.QueryRowContext(ctx, `
		WITH window_orders AS (
			SELECT customer_phone
			FROM orders
			WHERE shop_id = $1
			  AND status NOT IN ('cancelled')
			  AND (created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
		),
		first_orders AS (
			SELECT customer_phone, MIN(created_at) AS first_at
			FROM orders
			WHERE shop_id = $1 AND status NOT IN ('cancelled')
			GROUP BY customer_phone
		)
		SELECT
			(SELECT COUNT(DISTINCT customer_phone) FROM window_orders),
			(SELECT COUNT(*) FROM (
				SELECT customer_phone FROM window_orders GROUP BY customer_phone HAVING COUNT(*) > 1
			) sub),
			(SELECT COUNT(*) FROM first_orders f
				WHERE (f.first_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date)`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	).Scan(&rep.UniqueCustomers, &rep.RepeatCustomers, &rep.NewCustomerOrders)
	if err != nil {
		return nil, fmt.Errorf("order report customer trends: %w", err)
	}

	// 6. Top 5 customers by spend in the window.
	rows, err = r.db.QueryContext(ctx, `
		SELECT
			MAX(customer_name)         AS name,
			customer_phone,
			COUNT(*)                   AS orders,
			COALESCE(SUM(total_bdt), 0)::text
		FROM orders
		WHERE shop_id = $1
		  AND status NOT IN ('cancelled')
		  AND (created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
		GROUP BY customer_phone
		ORDER BY SUM(total_bdt) DESC
		LIMIT 5`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	)
	if err != nil {
		return nil, fmt.Errorf("order report top customers: %w", err)
	}
	for rows.Next() {
		var c domain.TopCustomer
		if err := rows.Scan(&c.CustomerName, &c.CustomerPhone, &c.Orders, &c.TotalBDT); err != nil {
			rows.Close()
			return nil, fmt.Errorf("order report top customers scan: %w", err)
		}
		rep.TopCustomers = append(rep.TopCustomers, c)
	}
	rows.Close()

	return rep, nil
}

// ProductReport aggregates product/inventory analytics for a date range.
// Inventory counts (out-of-stock, low-stock, total units) are current state;
// sales numbers are scoped to the window.
func (r *analyticsRepo) ProductReport(ctx context.Context, shopID string, from, to time.Time) (*domain.ProductReport, error) {
	rep := &domain.ProductReport{
		From: from,
		To:   to,
	}

	// 1. Catalog snapshot.
	err := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE is_archived = false AND is_active = true)               AS active_count,
			COUNT(*) FILTER (WHERE is_archived = true)                                     AS archived_count,
			COUNT(*) FILTER (WHERE stock = 0 AND is_archived = false AND is_active = true) AS out_count,
			COUNT(*) FILTER (WHERE stock > 0 AND stock <= $2
			                 AND is_archived = false AND is_active = true)                 AS low_count,
			COALESCE(SUM(stock) FILTER (WHERE is_archived = false), 0)::int                AS total_units,
			COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $5)::date
			                 BETWEEN $3::date AND $4::date)                                AS added_in_range
		FROM products
		WHERE shop_id = $1`,
		shopID, lowStockThreshold, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	).Scan(
		&rep.TotalActiveProducts, &rep.TotalArchived, &rep.OutOfStockCount,
		&rep.LowStockCount, &rep.TotalStockUnits, &rep.ProductsAddedInRange,
	)
	if err != nil {
		return nil, fmt.Errorf("product report snapshot: %w", err)
	}

	// 2. Per-product performance — left join so products with zero sales still appear.
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			p.id,
			p.name,
			COALESCE(c.name, '')                                         AS category_name,
			p.price_bdt::text,
			p.stock,
			COALESCE(SUM(oi.quantity) FILTER (
				WHERE o.status NOT IN ('cancelled')
				  AND (o.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
			), 0)::int                                                   AS units_sold,
			COALESCE(SUM(oi.line_total_bdt) FILTER (
				WHERE o.status NOT IN ('cancelled')
				  AND (o.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
			), 0)::text                                                  AS revenue,
			p.is_active,
			p.is_archived,
			p.created_at
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN order_items oi ON oi.product_id = p.id
		LEFT JOIN orders o ON o.id = oi.order_id AND o.shop_id = p.shop_id
		WHERE p.shop_id = $1
		  AND p.is_archived = false
		GROUP BY p.id, p.name, c.name, p.price_bdt, p.stock, p.is_active, p.is_archived, p.created_at
		ORDER BY units_sold DESC, p.name ASC`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ,
	)
	if err != nil {
		return nil, fmt.Errorf("product report rows: %w", err)
	}
	defer rows.Close()

	// Roll category numbers up while we stream rows.
	catAcc := map[string]*domain.CategoryReportRow{}
	var unitsSoldTotal int
	for rows.Next() {
		var rr domain.ProductReportRow
		var revBDT sql.NullString
		if err := rows.Scan(
			&rr.ProductID, &rr.ProductName, &rr.CategoryName, &rr.PriceBDT,
			&rr.CurrentStock, &rr.UnitsSold, &revBDT,
			&rr.IsActive, &rr.IsArchived, &rr.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("product report scan: %w", err)
		}
		if revBDT.Valid {
			rr.RevenueBDT = revBDT.String
		} else {
			rr.RevenueBDT = "0"
		}
		rep.Rows = append(rep.Rows, rr)
		unitsSoldTotal += rr.UnitsSold

		// Category rollup.
		key := rr.CategoryName
		if key == "" {
			key = "Uncategorized"
		}
		c, ok := catAcc[key]
		if !ok {
			c = &domain.CategoryReportRow{CategoryName: key}
			catAcc[key] = c
		}
		c.Products++
		c.UnitsSold += rr.UnitsSold
		var cur, addv float64
		fmt.Sscanf(c.RevenueBDT, "%f", &cur)
		fmt.Sscanf(rr.RevenueBDT, "%f", &addv)
		c.RevenueBDT = fmt.Sprintf("%.2f", cur+addv)
	}

	for _, c := range catAcc {
		rep.Categories = append(rep.Categories, *c)
	}
	// Sort categories by revenue desc — gofpdf doesn't care, but the seller
	// reads the highest performers first.
	sortCategoriesByRevenue(rep.Categories)

	// Top sellers (already sorted by units desc) and zero-movers.
	for _, rr := range rep.Rows {
		if rr.UnitsSold > 0 && len(rep.TopSellers) < 10 {
			rep.TopSellers = append(rep.TopSellers, rr)
		}
		if rr.UnitsSold == 0 && rr.IsActive {
			rep.NoMovement = append(rep.NoMovement, rr)
		}
	}

	// 3. Inventory alerts (current — sorted by potential lost revenue desc).
	alertRows, err := r.db.QueryContext(ctx, `
		SELECT id, name, stock, price_bdt::text
		FROM products
		WHERE shop_id = $1
		  AND is_archived = false
		  AND is_active = true
		  AND stock <= $2
		ORDER BY stock ASC, price_bdt DESC, name ASC`,
		shopID, lowStockThreshold,
	)
	if err != nil {
		return nil, fmt.Errorf("product report alerts: %w", err)
	}
	defer alertRows.Close()
	for alertRows.Next() {
		var p domain.LowStockProduct
		if err := alertRows.Scan(&p.ID, &p.Name, &p.Stock, &p.PriceBDT); err != nil {
			return nil, fmt.Errorf("product report alerts scan: %w", err)
		}
		if p.Stock == 0 {
			rep.OutOfStock = append(rep.OutOfStock, p)
		} else {
			rep.LowStock = append(rep.LowStock, p)
		}
	}

	// 4. Inventory turnover. Simple model: units sold in window /
	//    (current stock + units sold). Stays well-defined when stock = 0.
	denom := rep.TotalStockUnits + unitsSoldTotal
	if denom > 0 {
		rep.TurnoverPct = float64(unitsSoldTotal) / float64(denom) * 100
	}

	return rep, nil
}

func sortCategoriesByRevenue(cats []domain.CategoryReportRow) {
	for i := 1; i < len(cats); i++ {
		j := i
		for j > 0 {
			var a, b float64
			fmt.Sscanf(cats[j-1].RevenueBDT, "%f", &a)
			fmt.Sscanf(cats[j].RevenueBDT, "%f", &b)
			if a >= b {
				break
			}
			cats[j-1], cats[j] = cats[j], cats[j-1]
			j--
		}
	}
}
