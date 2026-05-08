package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// PaymentMethodRepository persists seller-configured advance-fee payment
// methods. All operations are shop-scoped: callers pass the shop ID and the
// repo enforces that returned/updated rows belong to that shop.
type PaymentMethodRepository interface {
	// List returns every payment method for a shop, ordered for display.
	List(ctx context.Context, shopID string) ([]*domain.ShopPaymentMethod, error)

	// ListPublic returns only active methods, ordered for display. Used by
	// the public storefront.
	ListPublic(ctx context.Context, shopID string) ([]*domain.ShopPaymentMethod, error)

	// Get returns a single payment method by ID.
	Get(ctx context.Context, id string) (*domain.ShopPaymentMethod, error)

	// Create inserts a new payment method and populates ID/timestamps.
	Create(ctx context.Context, m *domain.ShopPaymentMethod) error

	// Update overwrites an existing payment method by ID.
	Update(ctx context.Context, m *domain.ShopPaymentMethod) error

	// Delete removes a payment method by ID and shop. Returns
	// ErrPaymentMethodNotFound if no row matched.
	Delete(ctx context.Context, shopID, id string) error
}
