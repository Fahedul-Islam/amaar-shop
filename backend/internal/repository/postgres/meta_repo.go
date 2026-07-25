package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// maxMatchFields is the number of hashed identifiers we can realistically
// attach for a Bangladeshi COD order (phone, first name, last name, city,
// country, external id). Used to express match quality as a percentage.
const maxMatchFields = 6

type metaRepo struct {
	db *sql.DB
}

func NewMetaRepo(db *sql.DB) repository.MetaRepository {
	return &metaRepo{db: db}
}

func (r *metaRepo) GetSettings(ctx context.Context, shopID string) (*domain.MetaSettings, error) {
	s := &domain.MetaSettings{ShopID: shopID, TrackDelivered: true}
	err := r.db.QueryRowContext(ctx,
		`SELECT pixel_id, access_token, is_enabled, track_delivered, test_event_code, updated_at
		 FROM shop_meta_settings WHERE shop_id = $1`, shopID,
	).Scan(&s.PixelID, &s.AccessToken, &s.IsEnabled, &s.TrackDelivered, &s.TestEventCode, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return s, nil // not configured yet — defaults let the settings form render
	}
	if err != nil {
		return nil, fmt.Errorf("get meta settings: %w", err)
	}
	return s, nil
}

func (r *metaRepo) UpsertSettings(ctx context.Context, s *domain.MetaSettings) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO shop_meta_settings
		   (shop_id, pixel_id, access_token, is_enabled, track_delivered, test_event_code)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 ON CONFLICT (shop_id) DO UPDATE
		   SET pixel_id        = EXCLUDED.pixel_id,
		       access_token    = EXCLUDED.access_token,
		       is_enabled      = EXCLUDED.is_enabled,
		       track_delivered = EXCLUDED.track_delivered,
		       test_event_code = EXCLUDED.test_event_code`,
		s.ShopID, s.PixelID, s.AccessToken, s.IsEnabled, s.TrackDelivered, s.TestEventCode,
	)
	if err != nil {
		return fmt.Errorf("upsert meta settings: %w", err)
	}
	return nil
}

// EnqueueEvent is idempotent on (shop_id, event_id): re-firing the same
// conversion — a retried status update, a double-clicked button — is ignored
// rather than double-counted by Meta.
func (r *metaRepo) EnqueueEvent(ctx context.Context, e *domain.MetaEvent) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO meta_events
		   (shop_id, order_id, event_name, event_id, value_bdt, match_fields, event_time)
		 VALUES ($1, $2, $3, $4, $5::numeric, $6, $7)
		 ON CONFLICT (shop_id, event_id) DO NOTHING`,
		e.ShopID, e.OrderID, e.EventName, e.EventID, e.ValueBDT, e.MatchFields, e.EventTime,
	)
	if err != nil {
		return fmt.Errorf("enqueue meta event: %w", err)
	}
	return nil
}

func (r *metaRepo) ClaimPending(ctx context.Context, limit int) ([]domain.MetaEvent, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, shop_id, order_id, event_name, event_id, status, attempts,
		        COALESCE(last_error,''), value_bdt::text, match_fields, event_time, created_at
		 FROM meta_events
		 WHERE status = 'pending'
		 ORDER BY created_at
		 LIMIT $1`, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("claim pending meta events: %w", err)
	}
	defer rows.Close()

	out := make([]domain.MetaEvent, 0)
	for rows.Next() {
		var e domain.MetaEvent
		var orderID sql.NullString
		if err := rows.Scan(&e.ID, &e.ShopID, &orderID, &e.EventName, &e.EventID, &e.Status,
			&e.Attempts, &e.LastError, &e.ValueBDT, &e.MatchFields, &e.EventTime, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan meta event: %w", err)
		}
		if orderID.Valid {
			id := orderID.String
			e.OrderID = &id
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *metaRepo) MarkSent(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE meta_events
		 SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = NULL
		 WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("mark meta event sent: %w", err)
	}
	return nil
}

// MarkFailed parks an event permanently when the error can't be retried (a bad
// token won't fix itself) or when attempts run out; otherwise it stays pending
// for the next pass.
func (r *metaRepo) MarkFailed(ctx context.Context, id, errMsg string, retryable bool, maxAttempts int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE meta_events
		 SET attempts   = attempts + 1,
		     last_error = $2,
		     status     = CASE
		                    WHEN NOT $3 THEN 'failed'
		                    WHEN attempts + 1 >= $4 THEN 'failed'
		                    ELSE 'pending'
		                  END
		 WHERE id = $1`,
		id, errMsg, retryable, maxAttempts)
	if err != nil {
		return fmt.Errorf("mark meta event failed: %w", err)
	}
	return nil
}

func (r *metaRepo) TrackingStats(ctx context.Context, shopID string, from, to time.Time) (*domain.TrackingStats, error) {
	stats := &domain.TrackingStats{
		StartDate:   from.Format("2006-01-02"),
		EndDate:     to.Format("2006-01-02"),
		ByEventType: []domain.MetaEventTypeStat{},
	}
	_, _, fromInstant, toInstant := dayBounds(from, to)

	var avgMatch sql.NullFloat64
	var lastError sql.NullString
	var lastSent sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FILTER (WHERE status = 'sent'),
		        COUNT(*) FILTER (WHERE status = 'pending'),
		        COUNT(*) FILTER (WHERE status = 'failed'),
		        AVG(match_fields) FILTER (WHERE status = 'sent'),
		        COALESCE(SUM(value_bdt) FILTER (WHERE status = 'sent'), 0)::text,
		        MAX(last_error) FILTER (WHERE status = 'failed'),
		        MAX(sent_at)
		 FROM meta_events
		 WHERE shop_id = $1 AND created_at >= $2 AND created_at < $3`,
		shopID, fromInstant, toInstant,
	).Scan(&stats.TotalSent, &stats.TotalPending, &stats.TotalFailed,
		&avgMatch, &stats.ReportedValueBDT, &lastError, &lastSent)
	if err != nil {
		return nil, fmt.Errorf("meta tracking stats: %w", err)
	}
	if avgMatch.Valid {
		stats.AvgMatchFields = float64(int64(avgMatch.Float64*100+0.5)) / 100
		pct := avgMatch.Float64 / maxMatchFields * 100
		stats.MatchQualityPct = float64(int64(pct*10+0.5)) / 10
	}
	if lastError.Valid {
		stats.LastError = lastError.String
	}
	if lastSent.Valid {
		t := lastSent.Time
		stats.LastSentAt = &t
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT event_name,
		        COUNT(*) FILTER (WHERE status = 'sent'),
		        COUNT(*) FILTER (WHERE status = 'pending'),
		        COUNT(*) FILTER (WHERE status = 'failed'),
		        COALESCE(SUM(value_bdt) FILTER (WHERE status = 'sent'), 0)::text
		 FROM meta_events
		 WHERE shop_id = $1 AND created_at >= $2 AND created_at < $3
		 GROUP BY event_name
		 ORDER BY event_name`,
		shopID, fromInstant, toInstant,
	)
	if err != nil {
		return nil, fmt.Errorf("meta stats by type: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var s domain.MetaEventTypeStat
		if err := rows.Scan(&s.EventName, &s.Sent, &s.Pending, &s.Failed, &s.ValueBDT); err != nil {
			return nil, fmt.Errorf("scan meta stat: %w", err)
		}
		stats.ByEventType = append(stats.ByEventType, s)
	}
	return stats, rows.Err()
}

func (r *metaRepo) RecentEvents(ctx context.Context, shopID string, limit int) ([]domain.MetaEvent, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, shop_id, order_id, event_name, event_id, status, attempts,
		        COALESCE(last_error,''), value_bdt::text, match_fields, event_time, sent_at, created_at
		 FROM meta_events
		 WHERE shop_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`, shopID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("recent meta events: %w", err)
	}
	defer rows.Close()

	out := make([]domain.MetaEvent, 0)
	for rows.Next() {
		var e domain.MetaEvent
		var orderID sql.NullString
		var sentAt sql.NullTime
		if err := rows.Scan(&e.ID, &e.ShopID, &orderID, &e.EventName, &e.EventID, &e.Status,
			&e.Attempts, &e.LastError, &e.ValueBDT, &e.MatchFields, &e.EventTime, &sentAt, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan meta event: %w", err)
		}
		if orderID.Valid {
			id := orderID.String
			e.OrderID = &id
		}
		if sentAt.Valid {
			t := sentAt.Time
			e.SentAt = &t
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// FunnelStats is computed entirely from our own tables — Meta is never the
// source of truth for the seller's funnel.
func (r *metaRepo) FunnelStats(ctx context.Context, shopID string, from, to time.Time) (*domain.FunnelStats, error) {
	f := &domain.FunnelStats{
		StartDate: from.Format("2006-01-02"),
		EndDate:   to.Format("2006-01-02"),
	}
	_, _, fromInstant, toInstant := dayBounds(from, to)

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*), COUNT(DISTINCT visitor_id)
		 FROM product_visits
		 WHERE shop_id = $1 AND visited_at >= $2 AND visited_at < $3`,
		shopID, fromInstant, toInstant,
	).Scan(&f.ProductViews, &f.UniqueVisitors); err != nil {
		return nil, fmt.Errorf("funnel visits: %w", err)
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FILTER (WHERE status <> 'cancelled'),
		        COUNT(*) FILTER (WHERE status = 'delivered')
		 FROM orders
		 WHERE shop_id = $1 AND created_at >= $2 AND created_at < $3`,
		shopID, fromInstant, toInstant,
	).Scan(&f.OrdersPlaced, &f.OrdersDelivered); err != nil {
		return nil, fmt.Errorf("funnel orders: %w", err)
	}

	round1 := func(v float64) *float64 {
		r := float64(int64(v*10+0.5)) / 10
		return &r
	}
	if f.UniqueVisitors > 0 {
		f.ViewToOrderPct = round1(float64(f.OrdersPlaced) / float64(f.UniqueVisitors) * 100)
		f.ViewToDeliveredPct = round1(float64(f.OrdersDelivered) / float64(f.UniqueVisitors) * 100)
	}
	if f.OrdersPlaced > 0 {
		f.OrderToDeliveredPct = round1(float64(f.OrdersDelivered) / float64(f.OrdersPlaced) * 100)
	}
	return f, nil
}
