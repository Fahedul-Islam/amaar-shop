package domain

import (
	"errors"
	"time"
)

// CourierSettings holds a shop's courier-API credentials. Only one provider
// (Steadfast) is supported today; the provider column leaves room for more.
type CourierSettings struct {
	ShopID    string    `json:"shop_id"`
	Provider  string    `json:"provider"`
	APIKey    string    `json:"-"` // never serialised to clients
	SecretKey string    `json:"-"` // never serialised to clients
	IsEnabled bool      `json:"is_enabled"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Configured reports whether both credentials are present, i.e. the shop can
// actually book a courier. IsEnabled is the seller's on/off switch on top.
func (c CourierSettings) Configured() bool {
	return c.APIKey != "" && c.SecretKey != ""
}

var (
	// ErrCourierNotConfigured is returned when a shop tries to book a courier
	// without enabled, complete credentials.
	ErrCourierNotConfigured = errors.New("courier integration is not set up — add your Steadfast API keys in Settings")
)
