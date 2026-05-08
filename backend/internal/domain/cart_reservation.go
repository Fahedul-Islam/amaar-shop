package domain

import (
	"errors"
	"time"
)

// CartReservation holds stock for a buyer between entering checkout and
// placing the order. The lifecycle is:
//
//	active   — created, stock has been deducted from products.stock
//	consumed — order successfully placed; stock change is permanent
//	expired  — the sweeper or a request found the reservation past
//	           expires_at; stock has been restored
//	cancelled— buyer left the checkout flow; stock has been restored
type CartReservation struct {
	ID            string                `json:"id"`
	ShopID        string                `json:"shop_id"`
	CustomerPhone string                `json:"customer_phone,omitempty"`
	Status        string                `json:"status"`
	ExpiresAt     time.Time             `json:"expires_at"`
	CreatedAt     time.Time             `json:"created_at"`
	UpdatedAt     time.Time             `json:"updated_at"`
	Items         []CartReservationItem `json:"items"`
}

// CartReservationItem is one product line on a reservation.
type CartReservationItem struct {
	ID            string `json:"id"`
	ReservationID string `json:"reservation_id,omitempty"`
	ProductID     string `json:"product_id"`
	Quantity      int    `json:"quantity"`
}

const (
	ReservationStatusActive    = "active"
	ReservationStatusConsumed  = "consumed"
	ReservationStatusExpired   = "expired"
	ReservationStatusCancelled = "cancelled"
)

// ReservationDuration is the default hold window. Long enough for mobile
// banking + receipt upload, short enough not to lock inventory abusively.
const ReservationDuration = 15 * time.Minute

var (
	// ErrReservationNotFound is returned when a reservation ID doesn't
	// match any row, or matches a different shop than the request.
	ErrReservationNotFound = errors.New("reservation not found")

	// ErrReservationExpired is returned at consume/extend time when the
	// reservation is past its expires_at OR has already been
	// expired/cancelled/consumed by another path.
	ErrReservationExpired = errors.New("your hold has expired — please refresh and try again")

	// ErrReservationConsumed is returned when an order has already been
	// placed against this reservation.
	ErrReservationConsumed = errors.New("this reservation has already been used")

	// ErrEmptyReservation is returned when the create-reservation request
	// has no items (validation safety net).
	ErrEmptyReservation = errors.New("a reservation must include at least one item")
)
