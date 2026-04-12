// Package order contains HTTP handlers for the public order placement endpoint.
package order

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the order handler depends on.
type Service interface {
	// PlaceOrder places an order for a shop identified by slug.
	PlaceOrder(ctx context.Context, slug string, in service.PlaceOrderInput) (*domain.Order, error)

	// GetShopOrders retrieves orders for the authenticated shop owner with pagination and filters.
	GetShopOrders(ctx context.Context, ownerID, page, size, status, phone string) ([]*domain.Order, error)

	// GetShopOrderByID retrieves a specific order for the authenticated shop owner.
	GetShopOrderByID(ctx context.Context, ownerID, orderID string) (*domain.Order, error)

	// UpdateOrderStatus validates and updates the status of a specific order.
	UpdateOrderStatus(ctx context.Context, ownerID, orderID, status string, cancellationReason *string) (*domain.Order, error)

	// BuyerCancelOrder lets a buyer cancel their pending order with a reason.
	BuyerCancelOrder(ctx context.Context, slug, orderID, customerPhone, cancellationReason string) (*domain.Order, error)

	// MarkAdvanceReceived marks advance payment as received on an order.
	MarkAdvanceReceived(ctx context.Context, ownerID, orderID string) (*domain.Order, error)

	// LookupForCustomer looks up an order by ID + phone for the customer.
	LookupForCustomer(ctx context.Context, slug, orderID, customerPhone string) (*domain.Order, error)
}
