package analytics

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the analytics handler depends on.
type Service interface {
	TodayStats(ctx context.Context, ownerUserID string) (*domain.TodayStats, error)
	RangeStats(ctx context.Context, ownerUserID string, from, to time.Time) ([]domain.DayStat, error)
	TopProducts(ctx context.Context, ownerUserID string) ([]domain.TopProduct, error)
	PopularProducts(ctx context.Context, slug string) ([]domain.TopProduct, error)

	VisitSummary(ctx context.Context, ownerUserID string, period domain.VisitPeriod, days int) ([]domain.VisitBucketStats, time.Time, time.Time, error)
	TopVisitedProducts(ctx context.Context, ownerUserID string) ([]domain.TopVisitedProduct, error)
	VisitConversion(ctx context.Context, ownerUserID string, days int) (*domain.VisitConversion, error)
}
