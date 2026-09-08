package service

import (
	"context"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// cacheTTL is intentionally short — sellers expect dashboard counts to react
// the moment they mark an order delivered. 30s smooths refresh-button spam
// without making the data look stale.
const cacheTTL = 30 * time.Second

// AnalyticsService provides the seller's sales figures: order counts, revenue,
// best-sellers and the downloadable report bodies. Storefront traffic lives in
// VisitAnalyticsService instead.
//
// It still reads one visit figure — conversion — because the period summary
// reports revenue against traffic. That is a genuine cross-cut, so it depends
// on the single-method VisitConversionReader rather than the whole visit repo.
type AnalyticsService struct {
	shops     repository.ShopRepository
	analytics repository.AnalyticsRepository
	visits    repository.VisitConversionReader

	cache *ttlCache
}

func NewAnalyticsService(
	shops repository.ShopRepository,
	analytics repository.AnalyticsRepository,
	visits repository.VisitConversionReader,
) *AnalyticsService {
	return &AnalyticsService{
		shops:     shops,
		analytics: analytics,
		visits:    visits,
		cache:     newTTLCache(cacheTTL),
	}
}

// TodayStats returns today's aggregated statistics for the seller's shop.
func (s *AnalyticsService) TodayStats(ctx context.Context, ownerUserID string) (*domain.TodayStats, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return cachedValue(s.cache, "today:"+shop.ID, func() (*domain.TodayStats, error) {
		return s.analytics.TodayStats(ctx, shop.ID)
	})
}

// RangeStats returns a daily time series for the given date range.
func (s *AnalyticsService) RangeStats(ctx context.Context, ownerUserID string, from, to time.Time) ([]domain.DayStat, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	if err := checkRangeLimit(from, to); err != nil {
		return nil, err
	}

	key := fmt.Sprintf("range:%s:%s:%s", shop.ID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	return cachedValue(s.cache, key, func() ([]domain.DayStat, error) {
		return s.analytics.RangeStats(ctx, shop.ID, from, to)
	})
}

// TopProducts returns the top-selling products this month for the seller's shop.
func (s *AnalyticsService) TopProducts(ctx context.Context, ownerUserID string) ([]domain.TopProduct, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return cachedValue(s.cache, "top:"+shop.ID, func() ([]domain.TopProduct, error) {
		return s.analytics.TopProducts(ctx, shop.ID, 10)
	})
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
	return cachedValue(s.cache, "popular:"+shop.ID, func() ([]domain.TopProduct, error) {
		return s.analytics.PopularProducts(ctx, shop.ID, 10)
	})
}

// DashboardSummary returns the seller home page in a single call.
// Not cached: action counts must reflect the latest order/stock state so
// the seller sees a freshly-confirmed order disappear from "pending" the
// moment they tap.
func (s *AnalyticsService) DashboardSummary(ctx context.Context, ownerUserID string) (*domain.DashboardSummary, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.analytics.DashboardSummary(ctx, shop.ID)
}

// StatsSummary returns aggregate metrics for the current window and, when
// previous bounds are non-zero, the prior window plus percentage changes.
// Composing on top of RangeStats + Conversion avoids duplicating SQL.
func (s *AnalyticsService) StatsSummary(
	ctx context.Context,
	ownerUserID string,
	curFrom, curTo time.Time,
	prevFrom, prevTo time.Time,
) (*domain.StatsSummaryResult, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	cur, err := s.computeSummary(ctx, shop.ID, curFrom, curTo)
	if err != nil {
		return nil, err
	}
	out := &domain.StatsSummaryResult{Current: *cur}

	if !prevFrom.IsZero() && !prevTo.IsZero() {
		prev, err := s.computeSummary(ctx, shop.ID, prevFrom, prevTo)
		if err != nil {
			return nil, err
		}
		out.Previous = prev
		out.Changes = computeChanges(cur, prev)
	}
	return out, nil
}

// OrderReport builds the analytics block for the seller's downloadable
// order report. Not cached: report bodies are scoped to a user-chosen
// window and the seller expects fresh numbers when they hit "download".
func (s *AnalyticsService) OrderReport(ctx context.Context, ownerUserID string, from, to time.Time) (*domain.OrderReport, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.analytics.OrderReport(ctx, shop.ID, from, to)
}

// ProductReport builds the analytics block for the seller's downloadable
// product report.
func (s *AnalyticsService) ProductReport(ctx context.Context, ownerUserID string, from, to time.Time) (*domain.ProductReport, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.analytics.ProductReport(ctx, shop.ID, from, to)
}

func (s *AnalyticsService) computeSummary(ctx context.Context, shopID string, from, to time.Time) (*domain.PeriodSummary, error) {
	if err := checkRangeLimit(from, to); err != nil {
		return nil, err
	}

	days, err := s.analytics.RangeStats(ctx, shopID, from, to)
	if err != nil {
		return nil, err
	}
	conv, err := s.visits.Conversion(ctx, shopID, from, to)
	if err != nil {
		return nil, err
	}

	var revenue float64
	var orders int
	for _, d := range days {
		// RevenueBDT is a NUMERIC string from Postgres. ParseFloat keeps the
		// math simple; precision is ample for dashboard sums.
		var v float64
		fmt.Sscanf(d.RevenueBDT, "%f", &v)
		revenue += v
		orders += d.Orders
	}
	var aov float64
	if orders > 0 {
		aov = revenue / float64(orders)
	}

	return &domain.PeriodSummary{
		StartDate:    from.Format("2006-01-02"),
		EndDate:      to.Format("2006-01-02"),
		RevenueBDT:   fmt.Sprintf("%.2f", revenue),
		Orders:       orders,
		AOVBDT:       fmt.Sprintf("%.2f", aov),
		TotalVisits:  conv.TotalVisits,
		UniqueVisits: conv.UniqueVisits,
		OrderRate:    conv.OrderRate,
	}, nil
}

// maxRangeDays caps a query window so "This year" works but an unbounded
// range can't turn into a table scan.
const maxRangeDays = 366

func checkRangeLimit(from, to time.Time) error {
	if to.Sub(from).Hours() > maxRangeDays*24 {
		return fmt.Errorf("date range must not exceed %d days", maxRangeDays)
	}
	return nil
}

func computeChanges(cur, prev *domain.PeriodSummary) *domain.SummaryChanges {
	parse := func(s string) float64 {
		var v float64
		fmt.Sscanf(s, "%f", &v)
		return v
	}
	return &domain.SummaryChanges{
		RevenuePct:      pctChange(parse(cur.RevenueBDT), parse(prev.RevenueBDT)),
		OrdersPct:       pctChange(float64(cur.Orders), float64(prev.Orders)),
		AOVPct:          pctChange(parse(cur.AOVBDT), parse(prev.AOVBDT)),
		TotalVisitsPct:  pctChange(float64(cur.TotalVisits), float64(prev.TotalVisits)),
		UniqueVisitsPct: pctChange(float64(cur.UniqueVisits), float64(prev.UniqueVisits)),
		OrderRatePct:    pctChange(cur.OrderRate, prev.OrderRate),
	}
}

func pctChange(cur, prev float64) *float64 {
	if prev == 0 {
		return nil
	}
	v := (cur - prev) / prev * 100
	v = float64(int(v*100)) / 100
	return &v
}
