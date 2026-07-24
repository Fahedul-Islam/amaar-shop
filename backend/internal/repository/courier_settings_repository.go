package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// CourierSettingsRepository persists a shop's courier-API credentials.
type CourierSettingsRepository interface {
	// Get returns the settings for a shop. When no row exists it returns a
	// zero-value settings (disabled, empty keys) rather than an error, so the
	// settings page can render an empty form.
	Get(ctx context.Context, shopID string) (*domain.CourierSettings, error)

	// Upsert creates or updates the shop's courier settings.
	Upsert(ctx context.Context, s *domain.CourierSettings) error
}
