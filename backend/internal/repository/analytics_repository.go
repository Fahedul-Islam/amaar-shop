package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// AnalyticsRepository defines read-only queries for dashboard statistics.
type AnalyticsRepository interface {
	// TodayStats returns aggregate order counts and revenue for the current day.
	TodayStats(ctx context.Context, shopID string) (*domain.TodayStats, error)

	// RangeStats returns a daily time series of orders and revenue between from and to (inclusive).
	RangeStats(ctx context.Context, shopID string, from, to time.Time) ([]domain.DayStat, error)

	// TopProducts returns the top-selling products for the current month.
	TopProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error)

	// PopularProducts returns the top-selling products for a shop (public, no revenue exposed).
	PopularProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error)

	// DashboardSummary returns the home-page action queue + cash flow snapshot
	// in a single round-trip.
	DashboardSummary(ctx context.Context, shopID string) (*domain.DashboardSummary, error)
}
