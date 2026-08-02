package service

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// VisitAnalyticsService serves the seller's storefront-traffic dashboard.
//
// None of it is cached, on purpose: today's numbers move continuously and a
// seller who just watched a visit land would read a stale cache as a bug. The
// underlying queries hit indexed columns and stay fast without one.
type VisitAnalyticsService struct {
	shops  repository.ShopRepository
	visits repository.VisitStatsReader
}

func NewVisitAnalyticsService(
	shops repository.ShopRepository,
	visits repository.VisitStatsReader,
) *VisitAnalyticsService {
	return &VisitAnalyticsService{shops: shops, visits: visits}
}

// VisitSummary returns a date-bucketed visit time series for the seller's shop,
// along with the resolved window bounds so the caller can label the chart.
func (s *VisitAnalyticsService) VisitSummary(
	ctx context.Context,
	ownerUserID string,
	period domain.VisitPeriod,
	days int,
) ([]domain.VisitBucketStats, time.Time, time.Time, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, time.Time{}, time.Time{}, err
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -days+1)

	buckets, err := s.visits.VisitsByPeriod(ctx, shop.ID, period, from, to)
	if err != nil {
		return nil, time.Time{}, time.Time{}, err
	}
	return buckets, from, to, nil
}

// TopVisitedProducts returns the most-visited products for the seller's shop
// over the last 30 days.
func (s *VisitAnalyticsService) TopVisitedProducts(ctx context.Context, ownerUserID string) ([]domain.TopVisitedProduct, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -30)
	return s.visits.TopVisitedProducts(ctx, shop.ID, from, to, 10)
}

// VisitConversion returns visit-to-order conversion stats for the last `days` days.
func (s *VisitAnalyticsService) VisitConversion(ctx context.Context, ownerUserID string, days int) (*domain.VisitConversion, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -days+1)
	return s.visits.Conversion(ctx, shop.ID, from, to)
}
