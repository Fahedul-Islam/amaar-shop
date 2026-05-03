package domain

import (
	"errors"
	"time"
)

// DeliveryZone defines a per-division delivery fee override.
type DeliveryZone struct {
	ID             string `json:"id"`
	Division       string `json:"division"`
	DeliveryCharge string `json:"delivery_charge"`
}

// DeliverySettings holds per-shop delivery and COD configuration.
type DeliverySettings struct {
	ShopID                     string         `json:"shop_id"`
	CODEnabled                 bool           `json:"cod_enabled"`
	DeliveryCharge             string         `json:"delivery_charge"`
	FreeDeliveryThreshold      *string        `json:"free_delivery_threshold"`
	AdvancePaymentRequired     bool           `json:"advance_payment_required"`
	AdvancePaymentInstructions string         `json:"advance_payment_instructions"`
	DeliveryZones              []DeliveryZone `json:"delivery_zones"`
	UpdatedAt                  time.Time      `json:"updated_at"`
}

var (
	ErrInvalidDeliveryCharge = errors.New("delivery charge must be >= 0")
	ErrInvalidThreshold      = errors.New("free delivery threshold must be greater than delivery charge")
	ErrInvalidDivision       = errors.New("invalid division")
)

// AllowedDivisions mirrors the frontend list to prevent typos.
var AllowedDivisions = map[string]bool{
	"Dhaka": true, "Chattogram": true, "Khulna": true, "Rajshahi": true,
	"Barishal": true, "Sylhet": true, "Rangpur": true, "Mymensingh": true,
}
