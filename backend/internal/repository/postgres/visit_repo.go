package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type visitRepo struct {
	db *sql.DB
}

func NewVisitRepo(db *sql.DB) repository.VisitRepository {
	return &visitRepo{db: db}
}

// ShopIDForProduct verifies that productID belongs to a non-suspended shop with
// the given slug, returning the shop ID. (false, nil) means "not found" — we
// never surface specific reasons since this is a public endpoint.
func (r *visitRepo) ShopIDForProduct(ctx context.Context, slug, productID string) (string, bool, error) {
	var shopID string
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id
		FROM products p
		JOIN shops s ON s.id = p.shop_id
		WHERE p.id = $1
		  AND s.slug = $2
		  AND s.is_suspended = false
		  AND p.is_archived = false`,
		productID, slug,
	).Scan(&shopID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("shop id for product: %w", err)
	}
	return shopID, true, nil
}

// InsertBatch inserts all visits in a single multi-row INSERT. Empty batches
// short-circuit so callers can flush unconditionally on a tick.
func (r *visitRepo) InsertBatch(ctx context.Context, visits []domain.ProductVisit) error {
	if len(visits) == 0 {
		return nil
	}

	const colsPerRow = 6
	args := make([]interface{}, 0, len(visits)*colsPerRow)
	values := make([]string, 0, len(visits))
	for i, v := range visits {
		base := i * colsPerRow
		values = append(values, fmt.Sprintf("($%d, $%d, $%d, NULLIF($%d, ''), NULLIF($%d, ''), $%d)",
			base+1, base+2, base+3, base+4, base+5, base+6))
		args = append(args, v.ShopID, v.ProductID, v.VisitorID, v.Referrer, v.UserAgent, v.VisitedAt)
	}

	query := `INSERT INTO product_visits
	    (shop_id, product_id, visitor_id, referrer, user_agent, visited_at)
	    VALUES ` + strings.Join(values, ", ")

	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("insert product_visits batch: %w", err)
	}
	return nil
}

// AggregateDay rolls product_visits → product_visit_summary for the given day.
// Truncates the day in UTC to keep buckets stable regardless of server tz.
func (r *visitRepo) AggregateDay(ctx context.Context, day time.Time) (int, error) {
	dayStr := day.UTC().Format("2006-01-02")

	res, err := r.db.ExecContext(ctx, `
		INSERT INTO product_visit_summary
		    (shop_id, product_id, visit_date, total_visits, unique_visits, updated_at)
		SELECT
		    shop_id,
		    product_id,
		    visited_at::date AS visit_date,
		    COUNT(*)                            AS total_visits,
		    COUNT(DISTINCT visitor_id)          AS unique_visits,
		    now()
		FROM product_visits
		WHERE visited_at::date = $1::date
		GROUP BY shop_id, product_id, visited_at::date
		ON CONFLICT (shop_id, product_id, visit_date)
		DO UPDATE SET
		    total_visits  = EXCLUDED.total_visits,
		    unique_visits = EXCLUDED.unique_visits,
		    updated_at    = EXCLUDED.updated_at`,
		dayStr,
	)
	if err != nil {
		return 0, fmt.Errorf("aggregate day %s: %w", dayStr, err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// VisitsByPeriod returns a zero-filled time series. Period determines the
// bucket size; the underlying SQL uses generate_series to avoid gaps.
//
// Critical: today is read from raw events, not from the summary. The summary
// for today is only as fresh as the last aggregator run (00:30 UTC, plus
// startup), so trusting it would make new same-day visits invisible until
// the next cron tick.
func (r *visitRepo) VisitsByPeriod(ctx context.Context, shopID string, period domain.VisitPeriod, from, to time.Time) ([]domain.VisitBucketStats, error) {
	step, trunc, label := bucketParams(period)

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		WITH stats AS (
		    -- Past days: read from the pre-aggregated summary.
		    SELECT visit_date, total_visits, unique_visits
		    FROM product_visit_summary
		    WHERE shop_id = $1
		      AND visit_date < CURRENT_DATE
		    UNION ALL
		    -- Today: re-aggregate live so brand-new visits show up immediately.
		    SELECT visited_at::date,
		           COUNT(*)::int,
		           COUNT(DISTINCT visitor_id)::int
		    FROM product_visits
		    WHERE shop_id = $1
		      AND visited_at::date = CURRENT_DATE
		    GROUP BY visited_at::date
		)
		SELECT
		    to_char(b, %s)                          AS bucket,
		    COALESCE(SUM(s.total_visits), 0)::int   AS total_visits,
		    COALESCE(SUM(s.unique_visits), 0)::int  AS unique_visits
		FROM generate_series(date_trunc('%s', $2::date),
		                     date_trunc('%s', $3::date),
		                     '%s') AS b
		LEFT JOIN stats s
		    ON date_trunc('%s', s.visit_date::timestamp) = b
		GROUP BY b
		ORDER BY b`, label, trunc, trunc, step, trunc),
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("visits by period: %w", err)
	}
	defer rows.Close()

	out := make([]domain.VisitBucketStats, 0)
	for rows.Next() {
		var b domain.VisitBucketStats
		if err := rows.Scan(&b.Bucket, &b.TotalVisits, &b.UniqueVisits); err != nil {
			return nil, fmt.Errorf("visits by period scan: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// bucketParams returns (step, trunc-arg, to_char format) tuples for each period.
func bucketParams(period domain.VisitPeriod) (step, trunc, label string) {
	switch period {
	case domain.VisitPeriodWeekly:
		return "1 week", "week", "'IYYY-\"W\"IW'"
	case domain.VisitPeriodMonthly:
		return "1 month", "month", "'YYYY-MM'"
	default:
		return "1 day", "day", "'YYYY-MM-DD'"
	}
}

// TopVisitedProducts joins the summary table to products to surface names.
// Past days from the summary; today from raw events. Same trade-off as
// VisitsByPeriod: trusting the summary's "today" row would hide same-day
// visits between aggregator runs.
func (r *visitRepo) TopVisitedProducts(ctx context.Context, shopID string, from, to time.Time, limit int) ([]domain.TopVisitedProduct, error) {
	rows, err := r.db.QueryContext(ctx, `
		WITH combined AS (
		    SELECT product_id, total_visits, unique_visits
		    FROM product_visit_summary
		    WHERE shop_id = $1
		      AND visit_date < CURRENT_DATE
		      AND visit_date BETWEEN $2::date AND $3::date
		    UNION ALL
		    SELECT product_id,
		           COUNT(*)::int,
		           COUNT(DISTINCT visitor_id)::int
		    FROM product_visits
		    WHERE shop_id = $1
		      AND visited_at::date = CURRENT_DATE
		      AND CURRENT_DATE BETWEEN $2::date AND $3::date
		    GROUP BY product_id
		)
		SELECT p.id, p.name,
		       SUM(c.total_visits)::int  AS total_visits,
		       SUM(c.unique_visits)::int AS unique_visits
		FROM combined c
		JOIN products p ON p.id = c.product_id
		WHERE p.shop_id = $1
		GROUP BY p.id, p.name
		ORDER BY total_visits DESC
		LIMIT $4`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"), limit)
	if err != nil {
		return nil, fmt.Errorf("top visited products: %w", err)
	}
	defer rows.Close()

	out := make([]domain.TopVisitedProduct, 0)
	for rows.Next() {
		var t domain.TopVisitedProduct
		if err := rows.Scan(&t.ProductID, &t.ProductName, &t.TotalVisits, &t.UniqueVisits); err != nil {
			return nil, fmt.Errorf("top visited scan: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Conversion returns aggregate visit + order counts for the window. Both
// queries are scoped to one shop and use indexed columns.
//
// Past days come from product_visit_summary; today is recomputed from raw
// events on each call. See VisitsByPeriod for why the summary's "today" row
// must be ignored here.
func (r *visitRepo) Conversion(ctx context.Context, shopID string, from, to time.Time) (*domain.VisitConversion, error) {
	c := &domain.VisitConversion{}
	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")

	if err := r.db.QueryRowContext(ctx, `
		SELECT
		    COALESCE(SUM(total_visits), 0)::int  AS total_visits,
		    COALESCE(SUM(unique_visits), 0)::int AS unique_visits
		FROM product_visit_summary
		WHERE shop_id = $1
		  AND visit_date < CURRENT_DATE
		  AND visit_date BETWEEN $2::date AND $3::date`,
		shopID, fromStr, toStr,
	).Scan(&c.TotalVisits, &c.UniqueVisits); err != nil {
		return nil, fmt.Errorf("conversion summary: %w", err)
	}

	if from.Format("2006-01-02") <= to.Format("2006-01-02") {
		var todayTotal, todayUnique int
		if err := r.db.QueryRowContext(ctx, `
			SELECT COUNT(*)::int, COUNT(DISTINCT visitor_id)::int
			FROM product_visits
			WHERE shop_id = $1
			  AND visited_at::date = CURRENT_DATE
			  AND CURRENT_DATE BETWEEN $2::date AND $3::date`,
			shopID, fromStr, toStr,
		).Scan(&todayTotal, &todayUnique); err != nil {
			return nil, fmt.Errorf("conversion today: %w", err)
		}
		c.TotalVisits += todayTotal
		c.UniqueVisits += todayUnique
	}

	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)::int
		FROM orders
		WHERE shop_id = $1
		  AND status NOT IN ('cancelled')
		  AND (created_at AT TIME ZONE 'Asia/Dhaka')::date BETWEEN $2::date AND $3::date`,
		shopID, fromStr, toStr,
	).Scan(&c.OrderCount); err != nil {
		return nil, fmt.Errorf("conversion orders: %w", err)
	}

	if c.UniqueVisits > 0 {
		// Round to 2 decimal places.
		c.OrderRate = float64(int((float64(c.OrderCount)/float64(c.UniqueVisits))*10000)) / 100
	}
	return c, nil
}
