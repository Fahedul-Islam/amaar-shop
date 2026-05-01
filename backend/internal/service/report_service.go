package service

import (
	"context"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// ReportService owns the business rules for customer-submitted shop reports:
// validation of input from the public form, resolving slug → shop, and
// admin-only state transitions.
type ReportService struct {
	reports repository.ReportRepository
	shops   repository.ShopRepository
}

func NewReportService(reports repository.ReportRepository, shops repository.ShopRepository) *ReportService {
	return &ReportService{reports: reports, shops: shops}
}

// SubmitReport validates the customer's submission and inserts a new report.
// The reporter is anonymous unless they fill in name/phone — both optional.
func (s *ReportService) SubmitReport(ctx context.Context, in domain.CreateReportInput) (*domain.ShopReport, error) {
	// Validate reason against the allow-list — DB has a CHECK constraint too
	// but this gives a clean error code instead of a generic 500.
	if !domain.IsValidReportReason(in.Reason) {
		return nil, domain.ErrInvalidReportReason
	}

	desc := strings.TrimSpace(in.Description)
	if len(desc) < 10 {
		return nil, domain.ErrReportDescriptionTooShort
	}
	if len(desc) > 2000 {
		return nil, domain.ErrReportDescriptionTooLong
	}

	shop, err := s.shops.FindBySlug(ctx, in.ShopSlug)
	if err != nil {
		return nil, err
	}

	rep := &domain.ShopReport{
		ShopID:        shop.ID,
		Reason:        domain.ReportReason(in.Reason),
		Description:   desc,
		ReporterName:  strings.TrimSpace(in.ReporterName),
		ReporterPhone: strings.TrimSpace(in.ReporterPhone),
	}
	if err := s.reports.Create(ctx, rep); err != nil {
		return nil, err
	}
	return rep, nil
}

// List returns paginated reports for the admin view.
func (s *ReportService) List(ctx context.Context, f repository.ReportListFilter) ([]domain.AdminReportRow, int, error) {
	if f.PageSize <= 0 || f.PageSize > 200 {
		f.PageSize = 25
	}
	if f.Page < 1 {
		f.Page = 1
	}
	return s.reports.List(ctx, f)
}

// CountByStatus returns counts grouped by status — used by tab badges.
func (s *ReportService) CountByStatus(ctx context.Context) (map[string]int, error) {
	return s.reports.CountByStatus(ctx)
}

// FindByID returns one report.
func (s *ReportService) FindByID(ctx context.Context, id string) (*domain.AdminReportRow, error) {
	return s.reports.FindByID(ctx, id)
}

// UpdateStatus transitions a report to a new status. Only admins call this;
// auth is gated at the handler. Validates new status against the allow-list.
func (s *ReportService) UpdateStatus(ctx context.Context, reportID, newStatus, adminNote, adminUserID string) (*domain.AdminReportRow, error) {
	if !domain.IsValidReportStatus(newStatus) {
		return nil, domain.ErrInvalidReportStatus
	}
	if err := s.reports.UpdateStatus(ctx, reportID, newStatus, adminNote, adminUserID); err != nil {
		return nil, err
	}
	return s.reports.FindByID(ctx, reportID)
}
