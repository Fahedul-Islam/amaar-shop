package domain

import (
	"errors"
	"time"
)

// Order represents a customer order placed on a shop's storefront.
type Order struct {
	ID                     string      `json:"id"`
	ShopID                 string      `json:"shop_id"`
	CustomerName           string      `json:"customer_name"`
	CustomerPhone          string      `json:"customer_phone"`
	DeliveryAddress        string      `json:"delivery_address"`
	DeliveryDivision       string      `json:"delivery_division"`
	DeliveryDistrict       string      `json:"delivery_district"`
	DeliveryArea           string      `json:"delivery_area"`
	Note                   string      `json:"note"`
	SubtotalBDT            string      `json:"subtotal_bdt"`
	DeliveryChargeBDT      string      `json:"delivery_charge_bdt"`
	TotalBDT               string      `json:"total_bdt"`
	Status                 string      `json:"status"`
	// Shipment record. Populated when the seller hands the parcel to a courier
	// (manually in Phase 1, or via a courier API later). Empty until shipped.
	CourierName            string      `json:"courier_name,omitempty"`
	TrackingID             string      `json:"tracking_id,omitempty"`
	AdvancePaymentRequired bool        `json:"advance_payment_required"`
	AdvancePaymentReceived bool        `json:"advance_payment_received"`
	// Buyer-submitted advance-payment proof. Nil/empty until submitted.
	AdvancePaymentMethodID    *string    `json:"advance_payment_method_id,omitempty"`
	AdvancePaymentTxnRef      string     `json:"advance_payment_txn_ref,omitempty"`
	AdvancePaymentReceipt     string     `json:"advance_payment_receipt,omitempty"`
	AdvancePaymentSubmittedAt *time.Time `json:"advance_payment_submitted_at,omitempty"`
	// ReservationID, when set, tells PlaceOrder to consume a cart
	// reservation (skipping the stock decrement, since it was already
	// done at reserve time). Not persisted on the order row itself.
	ReservationID *string `json:"-"`
	CancelledReason           *string    `json:"cancelled_reason"`
	Items                     []OrderItem `json:"items"`
	CreatedAt                 time.Time   `json:"created_at"`
	UpdatedAt                 time.Time   `json:"updated_at"`
}

// OrderItem is a single line item within an order. Prices are snapshotted
// at order creation time so future product edits don't alter past orders.
type OrderItem struct {
	ID                   string `json:"id"`
	OrderID              string `json:"order_id,omitempty"`
	ProductID            string `json:"product_id"`
	ProductNameSnapshot  string `json:"product_name_snapshot"`
	UnitPriceSnapshotBDT string `json:"unit_price_snapshot_bdt"`
	Quantity             int    `json:"quantity"`
	LineTotalBDT         string `json:"line_total_bdt"`
}

// MarketplaceOrder is an order with the originating shop's name and slug
// attached, used for the cross-shop phone-lookup endpoint.
type MarketplaceOrder struct {
	Order
	ShopName string `json:"shop_name"`
	ShopSlug string `json:"shop_slug"`
}

var (
	ErrCheckoutDisabled           = errors.New("shop is not currently taking orders")
	ErrInvalidStatusTransition    = errors.New("invalid order status transition")
	ErrOrderNotFound              = errors.New("order not found")
	ErrCancellationReasonRequired = errors.New("cancellation reason is required")
	ErrCourierNameRequired        = errors.New("courier name is required")
)

var (
	Cancelled = "cancelled"
	Confirmed = "confirmed"
	Delivered = "delivered"
	Pending   = "pending"
	Returned  = "returned"
	Shipped   = "shipped"
)
