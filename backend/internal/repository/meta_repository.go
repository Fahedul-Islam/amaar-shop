package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// MetaRepository persists Conversions API settings and the event outbox.
type MetaRepository interface {
	// GetSettings returns a shop's Meta settings, or zero-value defaults when
	// none have been saved yet.
	GetSettings(ctx context.Context, shopID string) (*domain.MetaSettings, error)

	// UpsertSettings creates or updates a shop's Meta settings.
	UpsertSettings(ctx context.Context, s *domain.MetaSettings) error

	// EnqueueEvent adds a conversion to the outbox. Duplicate (shop, event_id)
	// pairs are ignored, so re-firing the same conversion is harmless.
	EnqueueEvent(ctx context.Context, e *domain.MetaEvent) error

	// ClaimPending returns up to limit pending events across all shops,
	// oldest first, for the dispatcher to deliver.
	ClaimPending(ctx context.Context, limit int) ([]domain.MetaEvent, error)

	// MarkSent flags an event as delivered.
	MarkSent(ctx context.Context, id string) error

	// MarkFailed records an attempt. When retryable is false — or attempts are
	// exhausted — the event is parked as failed instead of retried forever.
	MarkFailed(ctx context.Context, id, errMsg string, retryable bool, maxAttempts int) error

	// TrackingStats summarises event delivery health for a shop and period.
	TrackingStats(ctx context.Context, shopID string, from, to time.Time) (*domain.TrackingStats, error)

	// RecentEvents lists a shop's most recent events for the activity log.
	RecentEvents(ctx context.Context, shopID string, limit int) ([]domain.MetaEvent, error)

	// FunnelStats computes views → orders → delivered from our own data.
	FunnelStats(ctx context.Context, shopID string, from, to time.Time) (*domain.FunnelStats, error)
}
