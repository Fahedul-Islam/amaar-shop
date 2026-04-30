package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type analyticsRepo struct {
	db *sql.DB
}

func NewAnalyticsRepo(db *sql.DB) repository.AnalyticsRepository {
	return &analyticsRepo{db: db}
}

// shopTZ is the seller-facing timezone — Bangladesh-only platform, so we
// hard-code Asia/Dhaka. Postgres does the conversion in-query, so the host
// container's TZ doesn't matter.
const shopTZ = "Asia/Dhaka"

func (r *analyticsRepo) TodayStats(ctx context.Context, shopID string) (*domain.TodayStats, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)                                          AS total_orders,
			COUNT(*) FILTER (WHERE status = 'pending')        AS pending_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue_bdt,
			(now() AT TIME ZONE $2)::date                     AS today
		FROM orders
		WHERE shop_id = $1
		  AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
		shopID, shopTZ)

	s := &domain.TodayStats{}
	var today time.Time
	if err := row.Scan(&s.TotalOrders, &s.PendingOrders, &s.RevenueBDT, &today); err != nil {
		return nil, fmt.Errorf("today stats: %w", err)
	}
	s.Date = today.Format("2006-01-02")
	return s, nil
}

func (r *analyticsRepo) RangeStats(ctx context.Context, shopID string, from, to time.Time) ([]domain.DayStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			d::date                                                          AS date,
			COUNT(o.id)                                                      AS orders,
			COALESCE(SUM(o.total_bdt) FILTER (WHERE o.status NOT IN ('cancelled')), 0) AS revenue_bdt
		FROM generate_series($2::date, $3::date, '1 day') AS d
		LEFT JOIN orders o
			ON o.shop_id = $1
			AND (o.created_at AT TIME ZONE $4)::date = d::date
		GROUP BY d::date
		ORDER BY d::date`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), shopTZ)
	if err != nil {
		return nil, fmt.Errorf("range stats query: %w", err)
	}
	defer rows.Close()

	var stats []domain.DayStat
	for rows.Next() {
		var ds domain.DayStat
		var date time.Time
		if err := rows.Scan(&date, &ds.Orders, &ds.RevenueBDT); err != nil {
			return nil, fmt.Errorf("range stats scan: %w", err)
		}
		ds.Date = date.Format("2006-01-02")
		stats = append(stats, ds)
	}
	if stats == nil {
		stats = []domain.DayStat{}
	}
	return stats, nil
}

func (r *analyticsRepo) TopProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error) {
	// Current calendar month.
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			oi.product_id,
			oi.product_name_snapshot                          AS product_name,
			SUM(oi.quantity)                                  AS total_quantity,
			SUM(oi.line_total_bdt)                            AS total_revenue_bdt
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.shop_id = $1
		  AND o.status NOT IN ('cancelled')
		  AND o.created_at::date >= $2::date
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY total_quantity DESC
		LIMIT $3`,
		shopID, monthStart, limit)
	if err != nil {
		return nil, fmt.Errorf("top products query: %w", err)
	}
	defer rows.Close()

	var products []domain.TopProduct
	for rows.Next() {
		var tp domain.TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQuantity, &tp.TotalRevenueBDT); err != nil {
			return nil, fmt.Errorf("top products scan: %w", err)
		}
		products = append(products, tp)
	}
	if products == nil {
		products = []domain.TopProduct{}
	}
	return products, nil
}

// lowStockThreshold defines how close to zero stock a product must be to
// surface in the seller's reorder queue. 5 is small enough that sellers
// have a real chance to reorder before stocking out.
const lowStockThreshold = 5

// DashboardSummary returns everything the home page needs in one repo call.
// Each piece is its own query — composing them in SQL would obscure intent
// and the home page is hit once per visit, so two round-trips is fine.
func (r *analyticsRepo) DashboardSummary(ctx context.Context, shopID string) (*domain.DashboardSummary, error) {
	s := &domain.DashboardSummary{
		LowStockProducts: []domain.LowStockProduct{},
	}

	// Action queue + cash flow from orders table in a single aggregate.
	err := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'pending')                                               AS pending_orders,
			COUNT(*) FILTER (WHERE status IN ('pending','confirmed')
			                 AND advance_payment_required = true
			                 AND advance_payment_received = false)                                   AS awaiting_advance,
			COUNT(*) FILTER (WHERE status NOT IN ('cancelled')
			                 AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date) AS today_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status NOT IN ('cancelled')
			                 AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date), 0)::text AS today_revenue,
			COUNT(*) FILTER (WHERE status = 'shipped')                                               AS in_transit_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status = 'shipped'), 0)::text                      AS in_transit_amount,
			COUNT(*) FILTER (WHERE status = 'delivered'
			                 AND (updated_at AT TIME ZONE $2)::date >= (now() AT TIME ZONE $2)::date - 6) AS delivered_week_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status = 'delivered'
			                 AND (updated_at AT TIME ZONE $2)::date >= (now() AT TIME ZONE $2)::date - 6), 0)::text AS delivered_week_amount
		FROM orders
		WHERE shop_id = $1`,
		shopID, shopTZ,
	).Scan(
		&s.PendingOrdersCount,
		&s.AwaitingAdvanceCount,
		&s.TodayOrders,
		&s.TodayRevenueBDT,
		&s.InTransitOrders,
		&s.InTransitAmountBDT,
		&s.DeliveredWeekOrders,
		&s.DeliveredWeekBDT,
	)
	if err != nil {
		return nil, fmt.Errorf("dashboard order aggregate: %w", err)
	}

	// Stock counts. Out-of-stock = 0; low-stock = > 0 and <= threshold.
	err = r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE stock = 0)                                          AS out_of_stock,
			COUNT(*) FILTER (WHERE stock > 0 AND stock <= $2)                          AS low_stock
		FROM products
		WHERE shop_id = $1
		  AND is_archived = false
		  AND is_active = true`,
		shopID, lowStockThreshold,
	).Scan(&s.OutOfStockCount, &s.LowStockCount)
	if err != nil {
		return nil, fmt.Errorf("dashboard stock counts: %w", err)
	}

	// Top low-stock products to act on. Out-of-stock first, then ascending stock.
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, stock, price_bdt::text
		FROM products
		WHERE shop_id = $1
		  AND is_archived = false
		  AND is_active = true
		  AND stock <= $2
		ORDER BY stock ASC, name ASC
		LIMIT 5`,
		shopID, lowStockThreshold,
	)
	if err != nil {
		return nil, fmt.Errorf("dashboard low-stock list: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.LowStockProduct
		if err := rows.Scan(&p.ID, &p.Name, &p.Stock, &p.PriceBDT); err != nil {
			return nil, fmt.Errorf("dashboard low-stock scan: %w", err)
		}
		s.LowStockProducts = append(s.LowStockProducts, p)
	}

	// Unanswered review count.
	err = r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM product_reviews
		WHERE shop_id = $1
		  AND owner_reply IS NULL`,
		shopID,
	).Scan(&s.UnansweredReviewsCount)
	if err != nil {
		return nil, fmt.Errorf("dashboard unanswered reviews: %w", err)
	}

	return s, nil
}

// PopularProducts returns top-selling products (public — no revenue data leaked).
func (r *analyticsRepo) PopularProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error) {
	// Last 30 days.
	since := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			oi.product_id,
			oi.product_name_snapshot                          AS product_name,
			SUM(oi.quantity)                                  AS total_quantity
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.shop_id = $1
		  AND o.status NOT IN ('cancelled')
		  AND o.created_at::date >= $2::date
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY total_quantity DESC
		LIMIT $3`,
		shopID, since, limit)
	if err != nil {
		return nil, fmt.Errorf("popular products query: %w", err)
	}
	defer rows.Close()

	var products []domain.TopProduct
	for rows.Next() {
		var tp domain.TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQuantity); err != nil {
			return nil, fmt.Errorf("popular products scan: %w", err)
		}
		products = append(products, tp)
	}
	if products == nil {
		products = []domain.TopProduct{}
	}
	return products, nil
}
