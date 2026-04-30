package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// cacheTTL is intentionally short — sellers expect dashboard counts to react
// the moment they mark an order delivered. 30s smooths refresh-button spam
// without making the data look stale.
const cacheTTL = 30 * time.Second

// cacheEntry holds a cached value with its expiration time.
type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

// AnalyticsService provides dashboard statistics with a 5-minute in-memory cache.
type AnalyticsService struct {
	shops     repository.ShopRepository
	analytics repository.AnalyticsRepository
	visits    repository.VisitRepository

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func NewAnalyticsService(
	shops repository.ShopRepository,
	analytics repository.AnalyticsRepository,
	visits repository.VisitRepository,
) *AnalyticsService {
	return &AnalyticsService{
		shops:     shops,
		analytics: analytics,
		visits:    visits,
		cache:     make(map[string]cacheEntry),
	}
}

func (s *AnalyticsService) get(key string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.value, true
}

func (s *AnalyticsService) set(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[key] = cacheEntry{value: value, expiresAt: time.Now().Add(cacheTTL)}
}

// TodayStats returns today's aggregated statistics for the seller's shop.
func (s *AnalyticsService) TodayStats(ctx context.Context, ownerUserID string) (*domain.TodayStats, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	key := "today:" + shop.ID
	if cached, ok := s.get(key); ok {
		return cached.(*domain.TodayStats), nil
	}

	stats, err := s.analytics.TodayStats(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	s.set(key, stats)
	return stats, nil
}

// RangeStats returns a daily time series for the given date range.
func (s *AnalyticsService) RangeStats(ctx context.Context, ownerUserID string, from, to time.Time) ([]domain.DayStat, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	// Enforce max 90-day range.
	if to.Sub(from).Hours() > 90*24 {
		return nil, fmt.Errorf("date range must not exceed 90 days")
	}

	key := fmt.Sprintf("range:%s:%s:%s", shop.ID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	if cached, ok := s.get(key); ok {
		return cached.([]domain.DayStat), nil
	}

	stats, err := s.analytics.RangeStats(ctx, shop.ID, from, to)
	if err != nil {
		return nil, err
	}
	s.set(key, stats)
	return stats, nil
}

// TopProducts returns the top-selling products this month for the seller's shop.
func (s *AnalyticsService) TopProducts(ctx context.Context, ownerUserID string) ([]domain.TopProduct, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	key := "top:" + shop.ID
	if cached, ok := s.get(key); ok {
		return cached.([]domain.TopProduct), nil
	}

	products, err := s.analytics.TopProducts(ctx, shop.ID, 10)
	if err != nil {
		return nil, err
	}
	s.set(key, products)
	return products, nil
}

// VisitSummary returns a date-bucketed visit time series for the seller's shop.
// Not cached: today's data updates continuously and a stale cache would
// confuse sellers who just saw a visit land. The underlying queries hit
// indexed columns and stay fast even without caching.
func (s *AnalyticsService) VisitSummary(ctx context.Context, ownerUserID string, period domain.VisitPeriod, days int) ([]domain.VisitBucketStats, time.Time, time.Time, error) {
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
// over the last 30 days. Not cached (see VisitSummary).
func (s *AnalyticsService) TopVisitedProducts(ctx context.Context, ownerUserID string) ([]domain.TopVisitedProduct, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -30)
	return s.visits.TopVisitedProducts(ctx, shop.ID, from, to, 10)
}

// VisitConversion returns visit-to-order conversion stats for the last `days` days.
// Not cached (see VisitSummary).
func (s *AnalyticsService) VisitConversion(ctx context.Context, ownerUserID string, days int) (*domain.VisitConversion, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -days+1)
	return s.visits.Conversion(ctx, shop.ID, from, to)
}

// PopularProducts returns top products for the public storefront (no revenue data).
func (s *AnalyticsService) PopularProducts(ctx context.Context, slug string) ([]domain.TopProduct, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}

	key := "popular:" + shop.ID
	if cached, ok := s.get(key); ok {
		return cached.([]domain.TopProduct), nil
	}

	products, err := s.analytics.PopularProducts(ctx, shop.ID, 10)
	if err != nil {
		return nil, err
	}
	s.set(key, products)
	return products, nil
}
