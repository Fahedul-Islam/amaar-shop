package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// OrderRepository defines persistence operations for orders.
// PlaceOrder is transactional: it inserts the order + items and decrements
// product stock atomically so no over-sell can occur.
type OrderRepository interface {
	PlaceOrder(ctx context.Context, order *domain.Order) error
}
