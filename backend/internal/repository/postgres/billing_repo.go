package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// ----- FeeRule (singleton) -------------------------------------------------

type feeRuleRepo struct {
	db *sql.DB
}

func NewFeeRuleRepo(db *sql.DB) repository.FeeRuleRepository {
	return &feeRuleRepo{db: db}
}

func (r *feeRuleRepo) Get(ctx context.Context) (*domain.FeeRule, error) {
	rule := &domain.FeeRule{}
	var description sql.NullString
	var updatedBy sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT rule_type, value::text, description, updated_at, updated_by
		FROM fee_rule WHERE id = 1`,
	).Scan(&rule.RuleType, &rule.Value, &description, &rule.UpdatedAt, &updatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		// Should never happen post-migration, but return a safe default.
		return &domain.FeeRule{
			RuleType: domain.FeeRuleTypePercentage,
			Value:    "5.0000",
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get fee rule: %w", err)
	}
	rule.Description = description.String
	if updatedBy.Valid {
		rule.UpdatedBy = &updatedBy.String
	}
	return rule, nil
}

func (r *feeRuleRepo) Update(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error) {
	var updatedBy any
	if in.UpdatedBy != "" {
		updatedBy = in.UpdatedBy
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE fee_rule
		SET rule_type   = $1,
		    value       = $2::numeric,
		    description = NULLIF($3, ''),
		    updated_at  = now(),
		    updated_by  = $4
		WHERE id = 1`,
		in.RuleType, in.Value, in.Description, updatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("update fee rule: %w", err)
	}
	return r.Get(ctx)
}

// ----- FeeSubmission -------------------------------------------------------

type feeSubmissionRepo struct {
	db *sql.DB
}

func NewFeeSubmissionRepo(db *sql.DB) repository.FeeSubmissionRepository {
	return &feeSubmissionRepo{db: db}
}

// submissionColumns is the shared SELECT projection.
const submissionColumns = `
	s.id, s.shop_id, s.amount_bdt::text, s.payment_method,
	s.transaction_id, COALESCE(s.sender_account,''), COALESCE(s.note,''),
	s.status, COALESCE(s.admin_feedback,''),
	s.reviewed_by, s.reviewed_at, s.fee_payment_id, s.submitted_at`

func scanSubmission(s interface{ Scan(...any) error }) (*domain.FeeSubmission, error) {
	out := &domain.FeeSubmission{}
	var reviewedBy, feePaymentID sql.NullString
	var reviewedAt sql.NullTime
	if err := s.Scan(
		&out.ID, &out.ShopID, &out.AmountBDT, &out.PaymentMethod,
		&out.TransactionID, &out.SenderAccount, &out.Note,
		&out.Status, &out.AdminFeedback,
		&reviewedBy, &reviewedAt, &feePaymentID, &out.SubmittedAt,
	); err != nil {
		return nil, err
	}
	if reviewedBy.Valid {
		out.ReviewedBy = &reviewedBy.String
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		out.ReviewedAt = &t
	}
	if feePaymentID.Valid {
		out.FeePaymentID = &feePaymentID.String
	}
	return out, nil
}

func scanAdminSubmission(s interface{ Scan(...any) error }) (*domain.AdminFeeSubmissionRow, error) {
	out := &domain.AdminFeeSubmissionRow{}
	var reviewedBy, feePaymentID sql.NullString
	var reviewedAt sql.NullTime
	if err := s.Scan(
		&out.ID, &out.ShopID, &out.AmountBDT, &out.PaymentMethod,
		&out.TransactionID, &out.SenderAccount, &out.Note,
		&out.Status, &out.AdminFeedback,
		&reviewedBy, &reviewedAt, &feePaymentID, &out.SubmittedAt,
		&out.ShopName, &out.ShopSlug,
	); err != nil {
		return nil, err
	}
	if reviewedBy.Valid {
		out.ReviewedBy = &reviewedBy.String
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		out.ReviewedAt = &t
	}
	if feePaymentID.Valid {
		out.FeePaymentID = &feePaymentID.String
	}
	return out, nil
}

func (r *feeSubmissionRepo) Create(ctx context.Context, sub *domain.FeeSubmission) error {
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO shop_fee_submissions
		    (shop_id, amount_bdt, payment_method, transaction_id, sender_account, note)
		VALUES ($1, $2::numeric, $3, $4, NULLIF($5,''), NULLIF($6,''))
		RETURNING id, status, submitted_at`,
		sub.ShopID, sub.AmountBDT, sub.PaymentMethod, sub.TransactionID,
		sub.SenderAccount, sub.Note,
	).Scan(&sub.ID, &sub.Status, &sub.SubmittedAt)
	if err != nil {
		return fmt.Errorf("create submission: %w", err)
	}
	return nil
}

func (r *feeSubmissionRepo) FindByID(ctx context.Context, id string) (*domain.AdminFeeSubmissionRow, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT `+submissionColumns+`, sh.name, sh.slug
		FROM shop_fee_submissions s
		JOIN shops sh ON sh.id = s.shop_id
		WHERE s.id = $1`, id)
	out, err := scanAdminSubmission(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrSubmissionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find submission: %w", err)
	}
	return out, nil
}

func (r *feeSubmissionRepo) HasPending(ctx context.Context, shopID string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM shop_fee_submissions
		               WHERE shop_id = $1 AND status = 'pending')`,
		shopID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("has pending: %w", err)
	}
	return exists, nil
}

func (r *feeSubmissionRepo) List(ctx context.Context, f repository.FeeSubmissionListFilter) ([]domain.AdminFeeSubmissionRow, int, error) {
	conditions := []string{"1=1"}
	args := []any{}
	argN := 1
	if f.Status != "" {
		conditions = append(conditions, fmt.Sprintf("s.status = $%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if f.ShopID != "" {
		conditions = append(conditions, fmt.Sprintf("s.shop_id = $%d", argN))
		args = append(args, f.ShopID)
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM shop_fee_submissions s WHERE "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count submissions: %w", err)
	}

	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 25
	}
	listArgs := append(append([]any{}, args...), pageSize, f.Offset())

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT %s, sh.name, sh.slug
		FROM shop_fee_submissions s
		JOIN shops sh ON sh.id = s.shop_id
		WHERE %s
		ORDER BY s.submitted_at DESC
		LIMIT $%d OFFSET $%d`, submissionColumns, where, argN, argN+1), listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list submissions: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminFeeSubmissionRow, 0)
	for rows.Next() {
		row, err := scanAdminSubmission(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan submission: %w", err)
		}
		out = append(out, *row)
	}
	return out, total, rows.Err()
}

func (r *feeSubmissionRepo) CountByStatus(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM shop_fee_submissions GROUP BY status`,
	)
	if err != nil {
		return nil, fmt.Errorf("count submissions by status: %w", err)
	}
	defer rows.Close()

	out := map[string]int{
		string(domain.FeeSubmissionStatusPending):  0,
		string(domain.FeeSubmissionStatusApproved): 0,
		string(domain.FeeSubmissionStatusRejected): 0,
	}
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err != nil {
			return nil, fmt.Errorf("count submissions scan: %w", err)
		}
		out[s] = n
	}
	return out, rows.Err()
}

func (r *feeSubmissionRepo) MarkApproved(ctx context.Context, submissionID, feePaymentID, adminFeedback, adminUserID string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE shop_fee_submissions
		SET status         = 'approved',
		    admin_feedback = NULLIF($1, ''),
		    reviewed_by    = $2,
		    reviewed_at    = now(),
		    fee_payment_id = $3
		WHERE id = $4 AND status = 'pending'`,
		adminFeedback, adminUserID, feePaymentID, submissionID,
	)
	if err != nil {
		return fmt.Errorf("mark approved: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		// Either the submission doesn't exist or it's already been reviewed.
		// We disambiguate so the handler can return a precise error.
		row, ferr := r.FindByID(ctx, submissionID)
		if ferr != nil {
			return ferr
		}
		if row.Status != domain.FeeSubmissionStatusPending {
			return domain.ErrSubmissionAlreadyReviewed
		}
		return domain.ErrSubmissionNotFound
	}
	return nil
}

func (r *feeSubmissionRepo) MarkRejected(ctx context.Context, submissionID, adminFeedback, adminUserID string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE shop_fee_submissions
		SET status         = 'rejected',
		    admin_feedback = NULLIF($1, ''),
		    reviewed_by    = $2,
		    reviewed_at    = now()
		WHERE id = $3 AND status = 'pending'`,
		adminFeedback, adminUserID, submissionID,
	)
	if err != nil {
		return fmt.Errorf("mark rejected: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		row, ferr := r.FindByID(ctx, submissionID)
		if ferr != nil {
			return ferr
		}
		if row.Status != domain.FeeSubmissionStatusPending {
			return domain.ErrSubmissionAlreadyReviewed
		}
		return domain.ErrSubmissionNotFound
	}
	return nil
}

func (r *feeSubmissionRepo) RecentForShop(ctx context.Context, shopID string, limit int) ([]domain.FeeSubmission, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+submissionColumns+`
		FROM shop_fee_submissions s
		WHERE s.shop_id = $1
		ORDER BY s.submitted_at DESC
		LIMIT $2`, shopID, limit)
	if err != nil {
		return nil, fmt.Errorf("recent submissions: %w", err)
	}
	defer rows.Close()

	out := make([]domain.FeeSubmission, 0)
	for rows.Next() {
		sub, err := scanSubmission(rows)
		if err != nil {
			return nil, fmt.Errorf("recent submissions scan: %w", err)
		}
		out = append(out, *sub)
	}
	return out, rows.Err()
}
