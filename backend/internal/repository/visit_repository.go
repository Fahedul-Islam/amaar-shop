package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// VisitRepository persists raw product visit events and serves the
// pre-aggregated reads the seller dashboard relies on.
type VisitRepository interface {
	// InsertBatch writes a batch of visits in a single round-trip. Called by
	// the worker; returning an error on partial failures lets the worker log
	// and drop the batch (we don't retry — visit data is best-effort).
	InsertBatch(ctx context.Context, visits []domain.ProductVisit) error

	// ShopIDForProduct returns the shop ID for a (slug, productID) pair, or
	// (false, nil) if the product doesn't exist, the slug doesn't match, or
	// the shop is suspended. Used by the public visit-tracking endpoint to
	// validate the input before enqueueing.
	ShopIDForProduct(ctx context.Context, slug, productID string) (string, bool, error)

	// AggregateDay rolls raw events for the given UTC date into product_visit_summary.
	// Existing summary rows for that day are overwritten so re-running is safe.
	AggregateDay(ctx context.Context, day time.Time) (rowsAffected int, err error)

	// VisitsByPeriod returns a date-bucketed time series for one shop. Buckets are
	// either day / iso-week / month. The result has one entry per bucket in [from, to]
	// (zero-filled), so the chart never has gaps.
	VisitsByPeriod(ctx context.Context, shopID string, period domain.VisitPeriod, from, to time.Time) ([]domain.VisitBucketStats, error)

	// TopVisitedProducts returns the most-visited products for a shop in the given window.
	TopVisitedProducts(ctx context.Context, shopID string, from, to time.Time, limit int) ([]domain.TopVisitedProduct, error)

	// Conversion returns visits + orders so the dashboard can show visit→order rate.
	Conversion(ctx context.Context, shopID string, from, to time.Time) (*domain.VisitConversion, error)
}
