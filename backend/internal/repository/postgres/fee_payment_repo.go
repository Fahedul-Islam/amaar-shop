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

type feePaymentRepo struct {
	db *sql.DB
}

func NewFeePaymentRepo(db *sql.DB) repository.FeePaymentRepository {
	return &feePaymentRepo{db: db}
}

func (r *feePaymentRepo) RecordPayment(ctx context.Context, p *domain.ShopFeePayment) error {
	var recordedBy any
	if p.RecordedBy != nil {
		recordedBy = *p.RecordedBy
	}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO shop_fee_payments
		    (shop_id, amount_bdt, covers_until, recorded_by, note)
		VALUES ($1, $2::numeric, $3, $4, NULLIF($5, ''))
		RETURNING id, created_at`,
		p.ShopID, p.AmountBDT, p.CoversUntil, recordedBy, p.Note,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return fmt.Errorf("record fee payment: %w", err)
	}
	return nil
}

// scanFeePayment scans a single row from the fee_payments select projection.
func scanFeePayment(s interface{ Scan(...any) error }) (*domain.ShopFeePayment, error) {
	p := &domain.ShopFeePayment{}
	var recordedBy sql.NullString
	var note sql.NullString
	if err := s.Scan(
		&p.ID, &p.ShopID, &p.AmountBDT, &p.CoversUntil,
		&recordedBy, &note, &p.CreatedAt,
	); err != nil {
		return nil, err
	}
	if recordedBy.Valid {
		p.RecordedBy = &recordedBy.String
	}
	p.Note = note.String
	return p, nil
}

func (r *feePaymentRepo) LastPaymentForShop(ctx context.Context, shopID string) (*domain.ShopFeePayment, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, shop_id, amount_bdt::text, covers_until, recorded_by, note, created_at
		FROM shop_fee_payments
		WHERE shop_id = $1
		ORDER BY covers_until DESC
		LIMIT 1`, shopID)
	out, err := scanFeePayment(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil // never paid yet — not an error
	}
	if err != nil {
		return nil, fmt.Errorf("last fee payment: %w", err)
	}
	return out, nil
}

func (r *feePaymentRepo) LastPaymentsForAllShops(ctx context.Context) (map[string]*domain.ShopFeePayment, error) {
	// DISTINCT ON returns one row per shop_id — the latest one by covers_until.
	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT ON (shop_id)
		       id, shop_id, amount_bdt::text, covers_until, recorded_by, note, created_at
		FROM shop_fee_payments
		ORDER BY shop_id, covers_until DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("last payments all shops: %w", err)
	}
	defer rows.Close()

	out := make(map[string]*domain.ShopFeePayment)
	for rows.Next() {
		p, err := scanFeePayment(rows)
		if err != nil {
			return nil, fmt.Errorf("last payments scan: %w", err)
		}
		out[p.ShopID] = p
	}
	return out, rows.Err()
}

func (r *feePaymentRepo) CollectedBetween(ctx context.Context, start, end time.Time) (string, error) {
	var total string
	err := r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount_bdt), 0)::text
		FROM shop_fee_payments
		WHERE created_at >= $1 AND created_at < $2`,
		start, end,
	).Scan(&total)
	if err != nil {
		return "0", fmt.Errorf("fees collected: %w", err)
	}
	return total, nil
}

func (r *feePaymentRepo) History(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error) {
	if limit <= 0 {
		limit = 25
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, shop_id, amount_bdt::text, covers_until, recorded_by, note, created_at
		FROM shop_fee_payments
		WHERE shop_id = $1
		ORDER BY covers_until DESC
		LIMIT $2`, shopID, limit)
	if err != nil {
		return nil, fmt.Errorf("fee payment history: %w", err)
	}
	defer rows.Close()

	out := make([]domain.ShopFeePayment, 0)
	for rows.Next() {
		p, err := scanFeePayment(rows)
		if err != nil {
			return nil, fmt.Errorf("history scan: %w", err)
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}
