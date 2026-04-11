package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// DeliverySettingsRepository defines persistence operations for shop delivery settings.
type DeliverySettingsRepository interface {
	// Get returns the delivery settings for the given shop.
	Get(ctx context.Context, shopID string) (*domain.DeliverySettings, error)

	// Upsert creates or updates delivery settings for a shop.
	Upsert(ctx context.Context, settings *domain.DeliverySettings) error
}
