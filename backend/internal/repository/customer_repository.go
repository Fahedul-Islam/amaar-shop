package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// CustomerRepository serves the seller-facing customer views, all derived
// from the orders table plus a small customer_notes side table.
type CustomerRepository interface {
	// List returns customers for one shop with segment, search, and sort
	// applied. Segments are computed in SQL so filtering can push down.
	List(ctx context.Context, shopID string, f domain.CustomerListFilters) ([]domain.Customer, int, error)

	// Get returns a single customer by normalized phone, or ErrCustomerNotFound
	// when no orders exist for that phone.
	Get(ctx context.Context, shopID, normalizedPhone string) (*domain.Customer, error)

	// Orders returns the customer's full order history (newest first).
	Orders(ctx context.Context, shopID, normalizedPhone string) ([]domain.CustomerOrderSummary, error)

	// UpsertNote creates or replaces the seller's private note on the customer.
	UpsertNote(ctx context.Context, shopID, normalizedPhone, note string) error

	// DeleteNote clears the seller's note on the customer.
	DeleteNote(ctx context.Context, shopID, normalizedPhone string) error

	// Analytics returns the segment counts + LTV summary for the shop.
	Analytics(ctx context.Context, shopID string) (*domain.CustomerAnalytics, error)
}
