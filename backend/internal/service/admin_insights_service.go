package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AdminInsightsService is the read-only reporting side of the admin area:
// the overview widgets and the analytics / financial snapshots. It never
// writes, which is why it is kept apart from the moderation service.
type AdminInsightsService struct {
	repo    repository.AdminInsightsRepository
	feeRule repository.FeeRuleRepository
}

func NewAdminInsightsService(
	repo repository.AdminInsightsRepository,
	feeRule repository.FeeRuleRepository,
) *AdminInsightsService {
	return &AdminInsightsService{repo: repo, feeRule: feeRule}
}

// PlatformStats returns the headline overview numbers.
func (s *AdminInsightsService) PlatformStats(ctx context.Context) (*domain.PlatformStats, error) {
	return s.repo.PlatformStats(ctx)
}

// Overview bundles the home-page widgets (stats + recent shops + top shops)
// so the dashboard hydrates in one round-trip.
func (s *AdminInsightsService) Overview(ctx context.Context) (*domain.AdminOverview, error) {
	stats, err := s.repo.PlatformStats(ctx)
	if err != nil {
		return nil, err
	}
	recent, err := s.repo.RecentShops(ctx, 6)
	if err != nil {
		return nil, err
	}
	top, err := s.repo.TopShops(ctx, 30, 5)
	if err != nil {
		return nil, err
	}
	return &domain.AdminOverview{
		Stats:       stats,
		RecentShops: recent,
		TopShops:    top,
	}, nil
}

// AnalyticsReport returns the trailing-window insights snapshot.
func (s *AdminInsightsService) AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error) {
	return s.repo.AnalyticsReport(ctx, days)
}

// FinancialReport returns the money-and-payouts snapshot. It looks up the
// current fee rule first so all per-shop and aggregate fee numbers are
// computed against the same rule.
func (s *AdminInsightsService) FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error) {
	rule, err := s.feeRule.Get(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.FinancialReport(ctx, days, rule)
}
