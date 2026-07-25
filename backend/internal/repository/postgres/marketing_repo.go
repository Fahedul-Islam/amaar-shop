package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type marketingRepo struct {
	db *sql.DB
}

func NewMarketingRepo(db *sql.DB) repository.MarketingRepository {
	return &marketingRepo{db: db}
}

// UpsertAdSpend records a seller-confirmed figure. It always clears
// is_estimated: a number the seller typed supersedes anything the budget
// filler guessed for that day.
func (r *marketingRepo) UpsertAdSpend(ctx context.Context, s *domain.AdSpend) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO shop_ad_spend (shop_id, spend_date, platform, amount_bdt, note, is_estimated)
		 VALUES ($1, $2::date, $3, $4::numeric, NULLIF($5,''), false)
		 ON CONFLICT (shop_id, spend_date, platform) DO UPDATE
		   SET amount_bdt   = EXCLUDED.amount_bdt,
		       note         = EXCLUDED.note,
		       is_estimated = false
		 RETURNING id, updated_at`,
		s.ShopID, s.SpendDate, s.Platform, s.AmountBDT, s.Note,
	).Scan(&s.ID, &s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert ad spend: %w", err)
	}
	s.IsEstimated = false
	return nil
}

func (r *marketingRepo) ListAdBudgets(ctx context.Context, shopID string) ([]domain.AdBudget, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT shop_id, platform, daily_amount_bdt::text, is_active, starts_on::text, updated_at
		 FROM shop_ad_budgets WHERE shop_id = $1 ORDER BY platform`,
		shopID,
	)
	if err != nil {
		return nil, fmt.Errorf("list ad budgets: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdBudget, 0)
	for rows.Next() {
		var b domain.AdBudget
		if err := rows.Scan(&b.ShopID, &b.Platform, &b.DailyAmountBDT, &b.IsActive, &b.StartsOn, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan ad budget: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *marketingRepo) UpsertAdBudget(ctx context.Context, b *domain.AdBudget) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO shop_ad_budgets (shop_id, platform, daily_amount_bdt, is_active, starts_on)
		 VALUES ($1, $2, $3::numeric, $4, COALESCE(NULLIF($5,'')::date, CURRENT_DATE))
		 ON CONFLICT (shop_id, platform) DO UPDATE
		   SET daily_amount_bdt = EXCLUDED.daily_amount_bdt,
		       is_active        = EXCLUDED.is_active
		 RETURNING starts_on::text, updated_at`,
		b.ShopID, b.Platform, b.DailyAmountBDT, b.IsActive, b.StartsOn,
	).Scan(&b.StartsOn, &b.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert ad budget: %w", err)
	}
	return nil
}

// FillEstimatedSpend generates one spend row per active budget per missing day.
// generate_series expands each budget's date span, and the ON CONFLICT DO
// NOTHING guarantees a seller's own figure is never clobbered — which also
// makes the job safe to run as often as we like and self-healing after downtime.
func (r *marketingRepo) FillEstimatedSpend(ctx context.Context, today string, maxBackfillDays int) (int, error) {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO shop_ad_spend (shop_id, spend_date, platform, amount_bdt, is_estimated)
		 SELECT b.shop_id, d::date, b.platform, b.daily_amount_bdt, true
		 FROM shop_ad_budgets b
		 CROSS JOIN LATERAL generate_series(
		     GREATEST(b.starts_on, $1::date - $2::int),
		     $1::date,
		     interval '1 day'
		 ) AS d
		 WHERE b.is_active = true
		   AND b.daily_amount_bdt > 0
		 ON CONFLICT (shop_id, spend_date, platform) DO NOTHING`,
		today, maxBackfillDays,
	)
	if err != nil {
		return 0, fmt.Errorf("fill estimated spend: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// dayBounds converts an inclusive [from, to] date range into the two forms the
// queries need: plain date strings for DATE columns (no timezone conversion
// can distort them) and half-open instants for timestamptz columns.
func dayBounds(from, to time.Time) (fromDate, toDate string, fromInstant, toInstant time.Time) {
	return from.Format("2006-01-02"), to.Format("2006-01-02"), from, to.AddDate(0, 0, 1)
}

func (r *marketingRepo) ListAdSpend(ctx context.Context, shopID string, from, to time.Time) ([]domain.AdSpend, error) {
	fromDate, toDate, _, _ := dayBounds(from, to)
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, shop_id, spend_date::text, platform, amount_bdt::text, COALESCE(note,''), is_estimated, updated_at
		 FROM shop_ad_spend
		 WHERE shop_id = $1 AND spend_date BETWEEN $2::date AND $3::date
		 ORDER BY spend_date DESC, platform`,
		shopID, fromDate, toDate,
	)
	if err != nil {
		return nil, fmt.Errorf("list ad spend: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdSpend, 0)
	for rows.Next() {
		var a domain.AdSpend
		if err := rows.Scan(&a.ID, &a.ShopID, &a.SpendDate, &a.Platform, &a.AmountBDT, &a.Note, &a.IsEstimated, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan ad spend: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *marketingRepo) DeleteAdSpend(ctx context.Context, shopID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM shop_ad_spend WHERE id = $1 AND shop_id = $2`, id, shopID)
	if err != nil {
		return fmt.Errorf("delete ad spend: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrAdSpendNotFound
	}
	return nil
}

// ProfitSummary joins order outcomes with their line-item costs and the
// period's ad spend.
//
// Revenue counts only delivered orders: under cash-on-delivery an order is not
// income until the courier hands it over, and a returned parcel never becomes
// income. Booked revenue (everything not cancelled) is reported alongside so
// the seller can see how much is still in flight.
func (r *marketingRepo) ProfitSummary(ctx context.Context, shopID string, from, to time.Time) (*domain.ProfitSummary, error) {
	s := &domain.ProfitSummary{
		StartDate: from.Format("2006-01-02"),
		EndDate:   to.Format("2006-01-02"),
	}

	fromDate, toDate, fromInstant, toInstant := dayBounds(from, to)

	err := r.db.QueryRowContext(ctx,
		`WITH o AS (
		     SELECT id, status, total_bdt
		     FROM orders
		     WHERE shop_id = $1 AND created_at >= $2 AND created_at < $3
		 ),
		 line_costs AS (
		     SELECT oi.order_id,
		            SUM(COALESCE(oi.unit_cost_snapshot_bdt, 0) * oi.quantity) AS cogs,
		            COUNT(*) FILTER (WHERE oi.unit_cost_snapshot_bdt IS NULL)  AS missing_cost
		     FROM order_items oi
		     JOIN o ON o.id = oi.order_id
		     GROUP BY oi.order_id
		 )
		 SELECT
		   COUNT(*) FILTER (WHERE o.status <> 'cancelled')                                       AS total_orders,
		   COUNT(*) FILTER (WHERE o.status = 'delivered')                                        AS delivered_orders,
		   COUNT(*) FILTER (WHERE o.status = 'returned')                                         AS returned_orders,
		   COUNT(*) FILTER (WHERE o.status IN ('pending','confirmed','shipped'))                 AS in_flight_orders,
		   COALESCE(SUM(o.total_bdt) FILTER (WHERE o.status = 'delivered'), 0)::text             AS delivered_revenue,
		   COALESCE(SUM(o.total_bdt) FILTER (WHERE o.status <> 'cancelled'), 0)::text            AS booked_revenue,
		   COALESCE(SUM(lc.cogs)     FILTER (WHERE o.status = 'delivered'), 0)::text             AS cogs,
		   COALESCE(SUM(lc.missing_cost) FILTER (WHERE o.status = 'delivered'), 0)               AS items_missing_cost
		 FROM o
		 LEFT JOIN line_costs lc ON lc.order_id = o.id`,
		shopID, fromInstant, toInstant,
	).Scan(
		&s.TotalOrders, &s.DeliveredOrders, &s.ReturnedOrders, &s.InFlightOrders,
		&s.DeliveredRevenueBDT, &s.BookedRevenueBDT, &s.COGSBDT, &s.ItemsMissingCost,
	)
	if err != nil {
		return nil, fmt.Errorf("profit summary: %w", err)
	}

	// Ad spend for the same window, plus a per-platform breakdown.
	err = r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount_bdt), 0)::text,
		        COALESCE(SUM(amount_bdt) FILTER (WHERE is_estimated), 0)::text
		 FROM shop_ad_spend
		 WHERE shop_id = $1 AND spend_date BETWEEN $2::date AND $3::date`,
		shopID, fromDate, toDate,
	).Scan(&s.AdSpendBDT, &s.EstimatedSpendBDT)
	if err != nil {
		return nil, fmt.Errorf("profit summary ad spend: %w", err)
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT platform, SUM(amount_bdt)::text
		 FROM shop_ad_spend
		 WHERE shop_id = $1 AND spend_date BETWEEN $2::date AND $3::date
		 GROUP BY platform
		 ORDER BY SUM(amount_bdt) DESC`,
		shopID, fromDate, toDate,
	)
	if err != nil {
		return nil, fmt.Errorf("profit summary spend by platform: %w", err)
	}
	defer rows.Close()
	s.SpendByPlatform = make([]domain.PlatformSpend, 0)
	for rows.Next() {
		var p domain.PlatformSpend
		if err := rows.Scan(&p.Platform, &p.AmountBDT); err != nil {
			return nil, fmt.Errorf("scan platform spend: %w", err)
		}
		s.SpendByPlatform = append(s.SpendByPlatform, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return s, nil
}

func (r *marketingRepo) ProductProfit(ctx context.Context, shopID string, from, to time.Time, limit int) ([]domain.ProductProfit, error) {
	_, _, fromInstant, toInstant := dayBounds(from, to)
	rows, err := r.db.QueryContext(ctx,
		`SELECT oi.product_id,
		        MAX(oi.product_name_snapshot)                                        AS name,
		        SUM(oi.quantity)                                                     AS units,
		        SUM(oi.line_total_bdt)::text                                         AS revenue,
		        SUM(COALESCE(oi.unit_cost_snapshot_bdt,0) * oi.quantity)::text       AS cogs,
		        BOOL_AND(oi.unit_cost_snapshot_bdt IS NOT NULL)                      AS has_cost
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 WHERE o.shop_id = $1
		   AND o.status = 'delivered'
		   AND o.created_at >= $2 AND o.created_at < $3
		 GROUP BY oi.product_id
		 ORDER BY (SUM(oi.line_total_bdt) - SUM(COALESCE(oi.unit_cost_snapshot_bdt,0) * oi.quantity)) DESC
		 LIMIT $4`,
		shopID, fromInstant, toInstant, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("product profit: %w", err)
	}
	defer rows.Close()

	out := make([]domain.ProductProfit, 0)
	for rows.Next() {
		var p domain.ProductProfit
		if err := rows.Scan(&p.ProductID, &p.ProductName, &p.UnitsDelivered,
			&p.RevenueBDT, &p.COGSBDT, &p.HasCost); err != nil {
			return nil, fmt.Errorf("scan product profit: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
