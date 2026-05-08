package dto

type PlaceOrderRequest struct {
	CustomerName     string             `json:"customer_name"`
	CustomerPhone    string             `json:"customer_phone"`
	DeliveryAddress  string             `json:"delivery_address"`
	DeliveryDivision string             `json:"delivery_division"`
	DeliveryDistrict string             `json:"delivery_district"`
	Note             string             `json:"note"`
	Items            []OrderItemRequest `json:"items"`

	// Optional. Required when the shop's delivery settings demand advance proof.
	AdvancePaymentMethodID string `json:"advance_payment_method_id"`
	AdvancePaymentTxnRef   string `json:"advance_payment_txn_ref"`
	AdvancePaymentReceipt  string `json:"advance_payment_receipt"`

	// Optional. When set, the order is placed against a cart reservation
	// (stock was already debited at reserve time, so PlaceOrder skips
	// the per-item stock decrement and consumes the reservation).
	ReservationID string `json:"reservation_id"`
}

type OrderItemRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type OrderItemDTO struct {
	ID                   string `json:"id"`
	ProductID            string `json:"product_id"`
	ProductNameSnapshot  string `json:"product_name_snapshot"`
	UnitPriceSnapshotBDT string `json:"unit_price_snapshot_bdt"`
	Quantity             int    `json:"quantity"`
	LineTotalBDT         string `json:"line_total_bdt"`
}

type OrderDTO struct {
	ID                        string         `json:"id"`
	ShopID                    string         `json:"shop_id"`
	CustomerName              string         `json:"customer_name"`
	CustomerPhone             string         `json:"customer_phone"`
	DeliveryAddress           string         `json:"delivery_address"`
	DeliveryDivision          string         `json:"delivery_division"`
	DeliveryDistrict          string         `json:"delivery_district"`
	Note                      string         `json:"note"`
	SubtotalBDT               string         `json:"subtotal_bdt"`
	DeliveryChargeBDT         string         `json:"delivery_charge_bdt"`
	TotalBDT                  string         `json:"total_bdt"`
	Status                    string         `json:"status"`
	AdvancePaymentRequired    bool           `json:"advance_payment_required"`
	AdvancePaymentReceived    bool           `json:"advance_payment_received"`
	AdvancePaymentMethodID    *string        `json:"advance_payment_method_id,omitempty"`
	AdvancePaymentTxnRef      string         `json:"advance_payment_txn_ref,omitempty"`
	AdvancePaymentReceipt     string         `json:"advance_payment_receipt,omitempty"`
	AdvancePaymentSubmittedAt *string        `json:"advance_payment_submitted_at,omitempty"`
	CancelledReason           *string        `json:"cancelled_reason"`
	Items                     []OrderItemDTO `json:"items"`
	CreatedAt                 string         `json:"created_at"`
	UpdatedAt                 string         `json:"updated_at"`
}

// MarketplaceOrderDTO is OrderDTO enriched with the originating shop's name and slug,
// returned by the cross-shop phone-lookup endpoint.
type MarketplaceOrderDTO struct {
	OrderDTO
	ShopName string `json:"shop_name"`
	ShopSlug string `json:"shop_slug"`
}

// UpdateOrderStatusRequest is the body for POST /api/shops/me/orders/{id}/status.
type UpdateOrderStatusRequest struct {
	Status             string `json:"status"`
	CancellationReason string `json:"cancellation_reason"`
}

// BuyerCancelRequest is the body for POST /api/shops/by-slug/{slug}/orders/{id}/cancel.
type BuyerCancelRequest struct {
	CustomerPhone      string `json:"customer_phone"`
	CancellationReason string `json:"cancellation_reason"`
}

// CustomerLookupRequest is the body for POST /api/shops/by-slug/{slug}/orders/{id}/lookup.
type CustomerLookupRequest struct {
	CustomerPhone string `json:"customer_phone"`
}
