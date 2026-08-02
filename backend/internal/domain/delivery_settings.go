package domain

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

// DeliveryZone defines a per-division delivery fee override.
type DeliveryZone struct {
	ID             string `json:"id"`
	Division       string `json:"division"`
	DeliveryCharge string `json:"delivery_charge"`
}

// DeliverySettings holds per-shop delivery and COD configuration.
//
// IsConfigured flips to true the first time a seller explicitly saves their
// delivery settings. Product creation is blocked while it is false so sellers
// can't publish items before pricing delivery.
type DeliverySettings struct {
	ShopID                     string         `json:"shop_id"`
	IsConfigured               bool           `json:"is_configured"`
	CODEnabled                 bool           `json:"cod_enabled"`
	DeliveryCharge             string         `json:"delivery_charge"`
	FreeDeliveryThreshold      *string        `json:"free_delivery_threshold"`
	AdvancePaymentRequired     bool           `json:"advance_payment_required"`
	AdvancePaymentInstructions string         `json:"advance_payment_instructions"`
	DeliveryZones              []DeliveryZone `json:"delivery_zones"`
	UpdatedAt                  time.Time      `json:"updated_at"`
}

// DeliveryChargeFor returns the delivery fee for an order of the given
// subtotal shipping to the given division.
//
// Precedence: a matching per-division zone overrides the shop's default
// charge, and a met free-delivery threshold overrides both. Division matching
// ignores case and surrounding whitespace. An unparseable zone fee is skipped
// rather than treated as free, so a malformed row can't give away delivery.
//
// Lives on the settings rather than in the order service so the pricing rule
// sits with the data it reads, and can be exercised without a database.
func (d DeliverySettings) DeliveryChargeFor(division string, subtotal float64) float64 {
	charge, _ := strconv.ParseFloat(d.DeliveryCharge, 64)

	if division = strings.TrimSpace(division); division != "" {
		for _, z := range d.DeliveryZones {
			if strings.EqualFold(strings.TrimSpace(z.Division), division) {
				if zoneFee, err := strconv.ParseFloat(z.DeliveryCharge, 64); err == nil {
					charge = zoneFee
				}
				break
			}
		}
	}

	if d.FreeDeliveryThreshold != nil {
		if threshold, _ := strconv.ParseFloat(*d.FreeDeliveryThreshold, 64); threshold > 0 && subtotal >= threshold {
			charge = 0
		}
	}
	return charge
}

var (
	ErrInvalidDeliveryCharge = errors.New("delivery charge must be >= 0")
	ErrInvalidThreshold      = errors.New("free delivery threshold must be greater than delivery charge")
	ErrInvalidDivision       = errors.New("invalid division")
	ErrDeliveryNotConfigured = errors.New("delivery settings must be configured before adding products")
)

// AllowedDivisions mirrors the frontend list to prevent typos.
var AllowedDivisions = map[string]bool{
	"Dhaka": true, "Chattogram": true, "Khulna": true, "Rajshahi": true,
	"Barishal": true, "Sylhet": true, "Rangpur": true, "Mymensingh": true,
}
