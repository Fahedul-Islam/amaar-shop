package postgres

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// shopAdminTZ is the seller-facing timezone used when bucketing daily series.
// Same convention as the existing analytics repo: Bangladesh-only platform,
// hard-coded to keep query plans simple.
const shopAdminTZ = "Asia/Dhaka"

// AnalyticsReport returns the full insights snapshot for the trailing window.
// Layout: one query per "tile" — the page is intentionally read-mostly and
// admins won't load it more than a few times per session, so query count is
// fine in exchange for code that's easy to follow.
func (r *adminRepo) AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error) {
	if days <= 0 {
		days = 30
	}
	report := &domain.AnalyticsReport{Days: days}

	// Headlines (current vs previous window, same length).
	if err := r.fillAnalyticsHeadlines(ctx, days, report); err != nil {
		return nil, err
	}

	if err := r.fillAnalyticsDailySeries(ctx, days, report); err != nil {
		return nil, err
	}

	if err := r.fillAnalyticsBreakdowns(ctx, days, report); err != nil {
		return nil, err
	}

	return report, nil
}

// fillAnalyticsHeadlines populates the five top-of-page tiles in one round-trip.
func (r *adminRepo) fillAnalyticsHeadlines(ctx context.Context, days int, out *domain.AnalyticsReport) error {
	// One row per metric; previous and current windows in parallel.
	row := r.db.QueryRowContext(ctx, `
		WITH
		periods AS (
			SELECT
				now() - ($1 || ' days')::interval AS curr_start,
				now()                              AS curr_end,
				now() - ($2 || ' days')::interval  AS prev_start,
				now() - ($1 || ' days')::interval  AS prev_end
		),
		curr AS (
			SELECT
				COALESCE(SUM(total_bdt) FILTER (WHERE status != 'cancelled'), 0) AS gmv,
				COUNT(*)                                                         AS orders,
				COUNT(DISTINCT customer_phone)                                   AS customers
			FROM orders, periods WHERE created_at >= curr_start AND created_at < curr_end
		),
		prev AS (
			SELECT
				COALESCE(SUM(total_bdt) FILTER (WHERE status != 'cancelled'), 0) AS gmv,
				COUNT(*)                                                         AS orders,
				COUNT(DISTINCT customer_phone)                                   AS customers
			FROM orders, periods WHERE created_at >= prev_start AND created_at < prev_end
		),
		new_shops AS (
			SELECT
				(SELECT COUNT(*) FROM shops, periods WHERE created_at >= curr_start AND created_at < curr_end) AS curr,
				(SELECT COUNT(*) FROM shops, periods WHERE created_at >= prev_start AND created_at < prev_end) AS prev
		)
		SELECT
			curr.gmv::text,       prev.gmv::text,
			curr.orders,          prev.orders,
			curr.customers,       prev.customers,
			new_shops.curr,       new_shops.prev
		FROM curr, prev, new_shops`,
		strconv.Itoa(days), strconv.Itoa(days*2),
	)

	var (
		gmvCur, gmvPrev    string
		ordersCur, ordersPrev, custCur, custPrev, shopsCur, shopsPrev int
	)
	if err := row.Scan(&gmvCur, &gmvPrev, &ordersCur, &ordersPrev,
		&custCur, &custPrev, &shopsCur, &shopsPrev); err != nil {
		return fmt.Errorf("analytics headlines: %w", err)
	}

	out.GMV = makeMoneyMetric(gmvCur, gmvPrev)
	out.Orders = makeIntMetric(ordersCur, ordersPrev)
	out.NewCustomers = makeIntMetric(custCur, custPrev)
	out.NewShops = makeIntMetric(shopsCur, shopsPrev)
	out.AOV = makeAOVMetric(gmvCur, ordersCur, gmvPrev, ordersPrev)
	return nil
}

// fillAnalyticsDailySeries populates the orders-per-day and new-customers-per-day series.
func (r *adminRepo) fillAnalyticsDailySeries(ctx context.Context, days int, out *domain.AnalyticsReport) error {
	// Orders volume — one row per day.
	rows, err := r.db.QueryContext(ctx, `
		SELECT d::date, COUNT(o.id)
		FROM generate_series(
			(now() AT TIME ZONE $2)::date - ($1 - 1),
			(now() AT TIME ZONE $2)::date,
			'1 day'
		) AS d
		LEFT JOIN orders o
			ON (o.created_at AT TIME ZONE $2)::date = d::date
			AND o.status != 'cancelled'
		GROUP BY d::date
		ORDER BY d::date`,
		days, shopAdminTZ,
	)
	if err != nil {
		return fmt.Errorf("analytics orders daily: %w", err)
	}
	defer rows.Close()

	out.OrdersDaily = make([]domain.DailyPoint, 0, days)
	for rows.Next() {
		var d time.Time
		var n int
		if err := rows.Scan(&d, &n); err != nil {
			return fmt.Errorf("analytics orders daily scan: %w", err)
		}
		out.OrdersDaily = append(out.OrdersDaily, domain.DailyPoint{
			Date:  d.Format("2006-01-02"),
			Value: strconv.Itoa(n),
		})
	}

	// New customers per day — count distinct customer_phone for first appearance.
	rows2, err := r.db.QueryContext(ctx, `
		WITH first_seen AS (
			SELECT customer_phone, MIN(created_at) AS first_at
			FROM orders
			GROUP BY customer_phone
		)
		SELECT d::date, COUNT(fs.customer_phone)
		FROM generate_series(
			(now() AT TIME ZONE $2)::date - ($1 - 1),
			(now() AT TIME ZONE $2)::date,
			'1 day'
		) AS d
		LEFT JOIN first_seen fs
			ON (fs.first_at AT TIME ZONE $2)::date = d::date
		GROUP BY d::date
		ORDER BY d::date`,
		days, shopAdminTZ,
	)
	if err != nil {
		return fmt.Errorf("analytics new customers daily: %w", err)
	}
	defer rows2.Close()

	out.NewCustomersDaily = make([]domain.DailyPoint, 0, days)
	for rows2.Next() {
		var d time.Time
		var n int
		if err := rows2.Scan(&d, &n); err != nil {
			return fmt.Errorf("analytics new customers daily scan: %w", err)
		}
		out.NewCustomersDaily = append(out.NewCustomersDaily, domain.DailyPoint{
			Date:  d.Format("2006-01-02"),
			Value: strconv.Itoa(n),
		})
	}

	return nil
}

// fillAnalyticsBreakdowns populates top categories, top products, and geo distribution.
func (r *adminRepo) fillAnalyticsBreakdowns(ctx context.Context, days int, out *domain.AnalyticsReport) error {
	since := fmt.Sprintf("now() - interval '%d days'", days)

	// Top categories: GMV per category over the window.
	// Aliasing the SELECT name to category_name avoids the "name" ambiguity
	// against products.name when Postgres resolves GROUP BY identifiers.
	catRows, err := r.db.QueryContext(ctx, `
		SELECT COALESCE(c.name, 'Uncategorized') AS category_name,
		       COALESCE(SUM(oi.line_total_bdt), 0)::text AS gmv
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
		JOIN products p ON p.id = oi.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE o.created_at >= `+since+`
		GROUP BY category_name
		ORDER BY SUM(oi.line_total_bdt) DESC NULLS LAST
		LIMIT 8`,
	)
	if err != nil {
		return fmt.Errorf("analytics categories: %w", err)
	}
	defer catRows.Close()

	cats := make([]domain.CategoryBreakdown, 0)
	var catTotal float64
	for catRows.Next() {
		c := domain.CategoryBreakdown{}
		if err := catRows.Scan(&c.Name, &c.GMVBdt); err != nil {
			return fmt.Errorf("analytics category scan: %w", err)
		}
		cats = append(cats, c)
		v, _ := strconv.ParseFloat(c.GMVBdt, 64)
		catTotal += v
	}
	for i := range cats {
		v, _ := strconv.ParseFloat(cats[i].GMVBdt, 64)
		if catTotal > 0 {
			cats[i].Percentage = pctRound(v / catTotal * 100)
		}
	}
	out.TopCategories = cats

	// Top products: units sold over the window.
	prodRows, err := r.db.QueryContext(ctx, `
		SELECT p.id,
		       COALESCE(NULLIF(oi.product_name_snapshot, ''), p.name) AS name,
		       s.name AS shop_name,
		       SUM(oi.quantity)::int AS units,
		       SUM(oi.line_total_bdt)::text AS gmv,
		       COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1), '')
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
		JOIN products p ON p.id = oi.product_id
		JOIN shops s ON s.id = p.shop_id
		WHERE o.created_at >= `+since+`
		GROUP BY p.id, p.name, oi.product_name_snapshot, s.name
		ORDER BY units DESC
		LIMIT 8`,
	)
	if err != nil {
		return fmt.Errorf("analytics products: %w", err)
	}
	defer prodRows.Close()

	prods := make([]domain.TopProductRow, 0)
	for prodRows.Next() {
		p := domain.TopProductRow{}
		if err := prodRows.Scan(&p.ID, &p.Name, &p.ShopName, &p.UnitsSold, &p.GMVBdt, &p.ImageURL); err != nil {
			return fmt.Errorf("analytics product scan: %w", err)
		}
		prods = append(prods, p)
	}
	out.TopProducts = prods

	// Geographic distribution by delivery_area.
	geoRows, err := r.db.QueryContext(ctx, `
		SELECT delivery_area, COUNT(*)::int
		FROM orders
		WHERE created_at >= `+since+` AND status != 'cancelled'
		GROUP BY delivery_area
		ORDER BY COUNT(*) DESC
		LIMIT 8`,
	)
	if err != nil {
		return fmt.Errorf("analytics geo: %w", err)
	}
	defer geoRows.Close()

	geos := make([]domain.GeoBreakdown, 0)
	geoTotal := 0
	for geoRows.Next() {
		g := domain.GeoBreakdown{}
		if err := geoRows.Scan(&g.Area, &g.Orders); err != nil {
			return fmt.Errorf("analytics geo scan: %w", err)
		}
		geos = append(geos, g)
		geoTotal += g.Orders
	}
	for i := range geos {
		if geoTotal > 0 {
			geos[i].Percentage = pctRound(float64(geos[i].Orders) / float64(geoTotal) * 100)
		}
	}
	out.Geographic = geos

	return nil
}

// FinancialReport returns money-and-payouts data for the trailing window.
func (r *adminRepo) FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error) {
	if days <= 0 {
		days = 30
	}
	report := &domain.FinancialReport{Days: days}

	// Headlines: GMV, refunds, daily series — current vs previous window.
	row := r.db.QueryRowContext(ctx, `
		WITH periods AS (
			SELECT
				now() - ($1 || ' days')::interval AS curr_start,
				now()                              AS curr_end,
				now() - ($2 || ' days')::interval  AS prev_start,
				now() - ($1 || ' days')::interval  AS prev_end
		)
		SELECT
			COALESCE((SELECT SUM(total_bdt) FROM orders, periods
			          WHERE created_at >= curr_start AND created_at < curr_end AND status != 'cancelled'), 0)::text,
			COALESCE((SELECT SUM(total_bdt) FROM orders, periods
			          WHERE created_at >= prev_start AND created_at < prev_end AND status != 'cancelled'), 0)::text,
			COALESCE((SELECT SUM(total_bdt) FROM orders, periods
			          WHERE created_at >= curr_start AND created_at < curr_end AND status = 'cancelled'), 0)::text,
			COALESCE((SELECT SUM(total_bdt) FROM orders, periods
			          WHERE created_at >= prev_start AND created_at < prev_end AND status = 'cancelled'), 0)::text`,
		strconv.Itoa(days), strconv.Itoa(days*2),
	)

	var gmvCur, gmvPrev, refundCur, refundPrev string
	if err := row.Scan(&gmvCur, &gmvPrev, &refundCur, &refundPrev); err != nil {
		return nil, fmt.Errorf("financial headlines: %w", err)
	}

	report.GMV = makeMoneyMetric(gmvCur, gmvPrev)
	report.PlatformFee = makePlatformFeeMetric(gmvCur, gmvPrev)
	report.Refunds = makeMoneyMetric(refundCur, refundPrev)

	// Pending payouts = sum of all non-cancelled orders for shops whose owners
	// haven't been "paid" yet — we don't have a payouts table, so this is the
	// running total. Number of shops with any earnings is shown alongside.
	if err := r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(total_bdt), 0)::text,
			COUNT(DISTINCT shop_id)::int
		FROM orders
		WHERE status != 'cancelled'`,
	).Scan(&report.PendingPayouts, &report.PendingPayoutCount); err != nil {
		return nil, fmt.Errorf("financial pending: %w", err)
	}

	// Daily GMV series.
	rows, err := r.db.QueryContext(ctx, `
		SELECT d::date, COALESCE(SUM(o.total_bdt), 0)::text
		FROM generate_series(
			(now() AT TIME ZONE $2)::date - ($1 - 1),
			(now() AT TIME ZONE $2)::date,
			'1 day'
		) AS d
		LEFT JOIN orders o
			ON (o.created_at AT TIME ZONE $2)::date = d::date
			AND o.status != 'cancelled'
		GROUP BY d::date
		ORDER BY d::date`,
		days, shopAdminTZ,
	)
	if err != nil {
		return nil, fmt.Errorf("financial gmv daily: %w", err)
	}
	defer rows.Close()

	report.GMVDaily = make([]domain.DailyPoint, 0, days)
	for rows.Next() {
		var d time.Time
		var v string
		if err := rows.Scan(&d, &v); err != nil {
			return nil, fmt.Errorf("financial gmv daily scan: %w", err)
		}
		report.GMVDaily = append(report.GMVDaily, domain.DailyPoint{
			Date:  d.Format("2006-01-02"),
			Value: v,
		})
	}

	// Revenue split based on the current period's GMV.
	gmvF, _ := strconv.ParseFloat(gmvCur, 64)
	feeF := gmvF * domain.PlatformFeeRate
	toShopsF := gmvF - feeF
	report.RevenueSplit = domain.RevenueSplit{
		ToShopsBDT:     fmt.Sprintf("%.2f", toShopsF),
		PlatformFeeBDT: fmt.Sprintf("%.2f", feeF),
		ShopsPct:       100 - domain.PlatformFeeRate*100,
		FeePct:         domain.PlatformFeeRate * 100,
	}

	// Per-shop pending payouts.
	report.UpcomingPayouts, err = r.upcomingPayouts(ctx, days)
	if err != nil {
		return nil, err
	}

	return report, nil
}

// upcomingPayouts returns per-shop earnings (gross/fee/net) over the window.
func (r *adminRepo) upcomingPayouts(ctx context.Context, days int) ([]domain.ShopPayout, error) {
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT s.id, s.name, s.slug,
		       COUNT(o.id)::int,
		       COALESCE(SUM(o.total_bdt), 0)::text
		FROM shops s
		JOIN orders o ON o.shop_id = s.id
		WHERE o.created_at >= now() - interval '%d days'
		  AND o.status != 'cancelled'
		GROUP BY s.id, s.name, s.slug
		ORDER BY SUM(o.total_bdt) DESC
		LIMIT 25`, days),
	)
	if err != nil {
		return nil, fmt.Errorf("upcoming payouts: %w", err)
	}
	defer rows.Close()

	out := make([]domain.ShopPayout, 0)
	for rows.Next() {
		p := domain.ShopPayout{}
		if err := rows.Scan(&p.ShopID, &p.ShopName, &p.ShopSlug, &p.Orders, &p.GrossBDT); err != nil {
			return nil, fmt.Errorf("upcoming payouts scan: %w", err)
		}
		gross, _ := strconv.ParseFloat(p.GrossBDT, 64)
		fee := gross * domain.PlatformFeeRate
		p.FeeBDT = fmt.Sprintf("%.2f", fee)
		p.NetBDT = fmt.Sprintf("%.2f", gross-fee)
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListAdmins returns all admin users, oldest first (so the seeded super-admin
// is row 1).
func (r *adminRepo) ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, email, created_at
		FROM users
		WHERE is_admin = true
		ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("list admins: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminTeamMember, 0)
	for rows.Next() {
		m := domain.AdminTeamMember{}
		var createdAt time.Time
		if err := rows.Scan(&m.ID, &m.Email, &createdAt); err != nil {
			return nil, fmt.Errorf("list admins scan: %w", err)
		}
		m.CreatedAt = createdAt.Format("2006-01-02T15:04:05Z07:00")
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// First admin is treated as Super admin (the seeded one). Tag them.
	for i := range out {
		if i == 0 {
			out[i].IsSuperAdmin = true
			out[i].Role = "Super admin"
		} else {
			out[i].Role = "Admin"
		}
	}
	return out, nil
}

// SetUserAdmin promotes or demotes a user.
func (r *adminRepo) SetUserAdmin(ctx context.Context, userID string, isAdmin bool) error {
	res, err := r.db.ExecContext(ctx, `UPDATE users SET is_admin = $1 WHERE id = $2`, isAdmin, userID)
	if err != nil {
		return fmt.Errorf("set user admin: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

// ----- helpers -------------------------------------------------------------

// makeMoneyMetric builds a PeriodMetric for a string-encoded money value.
func makeMoneyMetric(curr, prev string) domain.PeriodMetric {
	curF, _ := strconv.ParseFloat(curr, 64)
	prevF, _ := strconv.ParseFloat(prev, 64)
	return domain.PeriodMetric{
		Current:  curr,
		Previous: prev,
		Pct:      pctChange(curF, prevF),
	}
}

// makePlatformFeeMetric derives fee from GMV using the platform fee rate.
func makePlatformFeeMetric(gmvCur, gmvPrev string) domain.PeriodMetric {
	curF, _ := strconv.ParseFloat(gmvCur, 64)
	prevF, _ := strconv.ParseFloat(gmvPrev, 64)
	cur := curF * domain.PlatformFeeRate
	prev := prevF * domain.PlatformFeeRate
	return domain.PeriodMetric{
		Current:  fmt.Sprintf("%.2f", cur),
		Previous: fmt.Sprintf("%.2f", prev),
		Pct:      pctChange(cur, prev),
	}
}

// makeIntMetric builds a PeriodMetric for an integer count.
func makeIntMetric(curr, prev int) domain.PeriodMetric {
	return domain.PeriodMetric{
		Current:  strconv.Itoa(curr),
		Previous: strconv.Itoa(prev),
		Pct:      pctChange(float64(curr), float64(prev)),
	}
}

// makeAOVMetric computes average order value (gmv / orders) for both periods.
func makeAOVMetric(gmvCur string, ordersCur int, gmvPrev string, ordersPrev int) domain.PeriodMetric {
	gmvCurF, _ := strconv.ParseFloat(gmvCur, 64)
	gmvPrevF, _ := strconv.ParseFloat(gmvPrev, 64)
	var aovCur, aovPrev float64
	if ordersCur > 0 {
		aovCur = gmvCurF / float64(ordersCur)
	}
	if ordersPrev > 0 {
		aovPrev = gmvPrevF / float64(ordersPrev)
	}
	return domain.PeriodMetric{
		Current:  fmt.Sprintf("%.2f", aovCur),
		Previous: fmt.Sprintf("%.2f", aovPrev),
		Pct:      pctChange(aovCur, aovPrev),
	}
}

// pctChange returns nil when prev is 0 (% is undefined).
func pctChange(cur, prev float64) *float64 {
	if prev == 0 {
		return nil
	}
	v := pctRound((cur - prev) / prev * 100)
	return &v
}

// pctRound rounds to one decimal place.
func pctRound(v float64) float64 {
	return float64(int(v*10+0.5*sign(v))) / 10
}

func sign(f float64) float64 {
	if f < 0 {
		return -1
	}
	return 1
}

