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

type reportRepo struct {
	db *sql.DB
}

// NewReportRepo returns a postgres-backed ReportRepository.
func NewReportRepo(db *sql.DB) repository.ReportRepository {
	return &reportRepo{db: db}
}

func (r *reportRepo) Create(ctx context.Context, rep *domain.ShopReport) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO shop_reports
		   (shop_id, reason, description, reporter_name, reporter_phone)
		 VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
		 RETURNING id, status, created_at`,
		rep.ShopID, rep.Reason, rep.Description, rep.ReporterName, rep.ReporterPhone,
	).Scan(&rep.ID, &rep.Status, &rep.CreatedAt)
	if err != nil {
		return fmt.Errorf("create report: %w", err)
	}
	return nil
}

// reportRowColumns is the shared SELECT projection for admin report rows
// (joined with shop name + slug).
const reportRowColumns = `
	r.id, r.shop_id, r.reason, r.description,
	COALESCE(r.reporter_name, ''), COALESCE(r.reporter_phone, ''),
	r.status, COALESCE(r.admin_note, ''),
	r.resolved_by, r.resolved_at, r.created_at,
	s.name, s.slug`

func scanReportRow(s interface{ Scan(...any) error }) (*domain.AdminReportRow, error) {
	row := &domain.AdminReportRow{}
	var resolvedBy sql.NullString
	var resolvedAt sql.NullTime
	if err := s.Scan(
		&row.ID, &row.ShopID, &row.Reason, &row.Description,
		&row.ReporterName, &row.ReporterPhone,
		&row.Status, &row.AdminNote,
		&resolvedBy, &resolvedAt, &row.CreatedAt,
		&row.ShopName, &row.ShopSlug,
	); err != nil {
		return nil, err
	}
	if resolvedBy.Valid {
		row.ResolvedBy = &resolvedBy.String
	}
	if resolvedAt.Valid {
		t := resolvedAt.Time
		row.ResolvedAt = &t
	}
	return row, nil
}

func (r *reportRepo) FindByID(ctx context.Context, id string) (*domain.AdminReportRow, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT `+reportRowColumns+`
		FROM shop_reports r
		JOIN shops s ON s.id = r.shop_id
		WHERE r.id = $1`, id)
	out, err := scanReportRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrReportNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find report: %w", err)
	}
	return out, nil
}

func (r *reportRepo) List(ctx context.Context, f domain.ReportListFilter) ([]domain.AdminReportRow, int, error) {
	conditions := []string{"1=1"}
	args := []any{}
	argN := 1

	if f.Status != "" {
		conditions = append(conditions, fmt.Sprintf("r.status = $%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if f.ShopID != "" {
		conditions = append(conditions, fmt.Sprintf("r.shop_id = $%d", argN))
		args = append(args, f.ShopID)
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM shop_reports r WHERE "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count reports: %w", err)
	}

	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 25
	}
	listArgs := append(append([]any{}, args...), pageSize, f.Offset())

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT %s
		FROM shop_reports r
		JOIN shops s ON s.id = r.shop_id
		WHERE %s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d`, reportRowColumns, where, argN, argN+1), listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list reports: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminReportRow, 0)
	for rows.Next() {
		row, err := scanReportRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan report: %w", err)
		}
		out = append(out, *row)
	}
	return out, total, rows.Err()
}

func (r *reportRepo) CountByStatus(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM shop_reports GROUP BY status`,
	)
	if err != nil {
		return nil, fmt.Errorf("count reports by status: %w", err)
	}
	defer rows.Close()

	out := map[string]int{
		string(domain.ReportStatusOpen):      0,
		string(domain.ReportStatusReviewing): 0,
		string(domain.ReportStatusResolved):  0,
		string(domain.ReportStatusDismissed): 0,
	}
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err != nil {
			return nil, fmt.Errorf("count reports scan: %w", err)
		}
		out[s] = n
	}
	return out, rows.Err()
}

func (r *reportRepo) UpdateStatus(ctx context.Context, reportID, newStatus, adminNote, resolverUserID string) error {
	// Stamp resolver/resolved_at only when moving into a terminal state.
	stampResolution := newStatus == string(domain.ReportStatusResolved) ||
		newStatus == string(domain.ReportStatusDismissed)

	var (
		res sql.Result
		err error
	)
	if stampResolution {
		res, err = r.db.ExecContext(ctx, `
			UPDATE shop_reports
			SET status = $1,
			    admin_note = NULLIF($2, ''),
			    resolved_by = $3,
			    resolved_at = now()
			WHERE id = $4`,
			newStatus, adminNote, resolverUserID, reportID,
		)
	} else {
		res, err = r.db.ExecContext(ctx, `
			UPDATE shop_reports
			SET status = $1,
			    admin_note = NULLIF($2, '')
			WHERE id = $3`,
			newStatus, adminNote, reportID,
		)
	}
	if err != nil {
		return fmt.Errorf("update report status: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrReportNotFound
	}
	return nil
}
