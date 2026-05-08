package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ReserveItemInput is one product line passed to Create.
type ReserveItemInput struct {
	ProductID string
	Quantity  int
}

// CartReservationRepository persists and manipulates cart reservations.
//
// Stock changes are part of every operation that changes status: Create
// decrements products.stock, Cancel and SweepExpired add it back. Consume
// is the exception — it just flips status to consumed; stock was already
// debited at create time.
type CartReservationRepository interface {
	// Create inserts a reservation + items and decrements products.stock
	// for each item, all in one transaction. Returns ErrInsufficientStock
	// (via the products.stock CHECK constraint) if any product can't
	// fully cover its requested quantity.
	Create(
		ctx context.Context,
		shopID string,
		expiresAt time.Time,
		items []ReserveItemInput,
	) (*domain.CartReservation, error)

	// Get returns a reservation + items by ID. Returns ErrReservationNotFound
	// if no row matches the (id, shopID) pair.
	Get(ctx context.Context, shopID, id string) (*domain.CartReservation, error)

	// Cancel transitions an active reservation to 'cancelled' and adds
	// stock back. Idempotent on already-non-active rows: returns nil
	// without changing stock if the reservation is already consumed,
	// expired, or cancelled.
	Cancel(ctx context.Context, shopID, id string) (*domain.CartReservation, error)

	// AttachPhone records the buyer's phone on the reservation, used for
	// admin lookups. Errors quietly: if the reservation is gone,
	// nothing happens.
	AttachPhone(ctx context.Context, id, phone string) error

	// SweepExpired transitions every active reservation past expires_at
	// to 'expired' and restores stock for each item. Returns the number
	// of reservations expired by this call.
	SweepExpired(ctx context.Context) (int, error)
}
