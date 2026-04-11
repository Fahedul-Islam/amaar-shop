package domain

import (
	"errors"
	"time"
)

// DeliverySettings holds per-shop delivery and COD configuration.
type DeliverySettings struct {
	ShopID                   string    `json:"shop_id"`
	CODEnabled               bool      `json:"cod_enabled"`
	DeliveryCharge           string    `json:"delivery_charge"`
	FreeDeliveryThreshold    *string   `json:"free_delivery_threshold"`
	AdvancePaymentRequired   bool      `json:"advance_payment_required"`
	AdvancePaymentInstructions string  `json:"advance_payment_instructions"`
	DeliveryAreas            []string  `json:"delivery_areas"`
	UpdatedAt                time.Time `json:"updated_at"`
}

var (
	ErrInvalidDeliveryCharge   = errors.New("delivery charge must be >= 0")
	ErrInvalidThreshold        = errors.New("free delivery threshold must be greater than delivery charge")
	ErrDeliveryAreasRequired   = errors.New("delivery areas required when COD is enabled")
)
