package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ReportListFilter is the standard filter shape for paginated admin report lists.
type ReportListFilter struct {
	Status   string
	ShopID   string
	Page     int
	PageSize int
}

// Offset returns the SQL offset for the given page/page_size.
func (f ReportListFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.PageSize
}

// ReportRepository handles persistence of customer-submitted shop reports.
type ReportRepository interface {
	// Create inserts a new report. Caller must have already resolved the
	// shop slug to an ID and validated all input.
	Create(ctx context.Context, r *domain.ShopReport) error

	// FindByID returns one report joined with its shop info.
	FindByID(ctx context.Context, id string) (*domain.AdminReportRow, error)

	// List returns paginated reports with optional status/shop filters.
	List(ctx context.Context, f ReportListFilter) ([]domain.AdminReportRow, int, error)

	// CountByStatus returns counts grouped by status — used by the admin tab badges.
	CountByStatus(ctx context.Context) (map[string]int, error)

	// UpdateStatus changes status + admin_note. When moving to resolved/dismissed
	// the resolver and resolved_at are stamped automatically.
	UpdateStatus(ctx context.Context, reportID, newStatus, adminNote, resolverUserID string) error
}
