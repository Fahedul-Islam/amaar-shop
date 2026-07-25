package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// BuyerEditableFields carries the mutable subset of order fields that a
// buyer may change while their order is still pending and unconfirmed.
type BuyerEditableFields struct {
	DeliveryAddress  string
	DeliveryDivision string
	DeliveryDistrict string
	Note             string
}

// OrderRepository defines persistence operations for orders.
// PlaceOrder is transactional: it inserts the order + items and decrements
// product stock atomically so no over-sell can occur.
type OrderRepository interface {
	PlaceOrder(ctx context.Context, order *domain.Order) error

	// OrderListByShopOwner returns orders for the shop owned by ownerUserID.
	// Optional filters: status (empty = all), phone (empty = all).
	OrderListByShopOwner(ctx context.Context, ownerUserID string, status, phone string, limit, offset int) ([]*domain.Order, error)
	// OrderByIDForShopOwner returns the order with the given ID if it belongs to the shop owned by ownerUserID.
	OrderByIDForShopOwner(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error)

	// OrderByID returns an order without any ownership scoping. Reserved for
	// background jobs that already hold a trusted order ID (e.g. the Meta
	// conversions dispatcher); never call it from a request handler.
	OrderByID(ctx context.Context, orderID string) (*domain.Order, error)

	// UpdateOrderStatusForShopOwner updates the status (and optional cancellation reason)
	// of the order if it belongs to the shop owned by ownerUserID.
	// If the new status is "cancelled", stock is restored in the same transaction.
	UpdateOrderStatusForShopOwner(ctx context.Context, ownerUserID, orderID, status string, cancelledReason *string) (*domain.Order, error)

	// RestoreCancelledOrder reverses a cancellation: sets status back to "pending",
	// clears cancelled_reason, and re-decrements product stock atomically.
	// Returns ErrInsufficientStock if any item can no longer be re-served.
	RestoreCancelledOrder(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error)

	// CancelOrderByBuyer cancels an order identified by shopID + orderID + customerPhone.
	// Only orders in "pending" status can be cancelled by the buyer.
	// Stock is restored in the same transaction.
	CancelOrderByBuyer(ctx context.Context, shopID, orderID, customerPhone, cancelledReason string) (*domain.Order, error)

	// MarkAdvanceReceived sets advance_payment_received to received on the order.
	MarkAdvanceReceived(ctx context.Context, ownerUserID, orderID string, received bool) (*domain.Order, error)

	// SetShipment records courier name + tracking ID on an order. When
	// markShipped is true the status is advanced to 'shipped' atomically.
	SetShipment(ctx context.Context, ownerUserID, orderID, courierName, trackingID string, markShipped bool) (*domain.Order, error)

	// SubmitAdvanceProof persists the buyer's advance-payment proof on a
	// pending order. Returns ErrOrderLocked if the seller has already
	// confirmed receipt.
	SubmitAdvanceProof(ctx context.Context, shopID, orderID, customerPhone, methodID, txnRef, receipt string) (*domain.Order, error)

	// UpdateBuyerEditableFields updates address/note/phone on a still-pending
	// order. Returns ErrOrderLocked if seller has confirmed.
	UpdateBuyerEditableFields(ctx context.Context, shopID, orderID, customerPhone string, fields BuyerEditableFields) (*domain.Order, error)

	// FindByIDAndPhone returns an order for the given shop + order ID + customer phone.
	// Used for customer-facing order lookup.
	FindByIDAndPhone(ctx context.Context, shopID, orderID, customerPhone string) (*domain.Order, error)

	// LoadItems loads order items for the given order IDs and attaches them.
	LoadItems(ctx context.Context, orders ...*domain.Order) error
}
