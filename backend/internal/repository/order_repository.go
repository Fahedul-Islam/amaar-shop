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

	// OrderListByShopOwner returns all orders for the shop owned by ownerUserID.
	OrderListByShopOwner(ctx context.Context, ownerUserID string, limit, offset int) ([]*domain.Order, error)
	// OrderByIDForShopOwner returns the order with the given ID if it belongs to the shop owned by ownerUserID.
	OrderByIDForShopOwner(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error)

	// UpdateOrderStatusForShopOwner updates the status (and optional cancellation reason)
	// of the order if it belongs to the shop owned by ownerUserID.
	UpdateOrderStatusForShopOwner(ctx context.Context, ownerUserID, orderID, status string, cancelledReason *string) (*domain.Order, error)

	// CancelOrderByBuyer cancels an order identified by shopID + orderID + customerPhone.
	// Only orders in "pending" status can be cancelled by the buyer.
	CancelOrderByBuyer(ctx context.Context, shopID, orderID, customerPhone, cancelledReason string) (*domain.Order, error)
}
