package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// FeePaymentRepository handles persistence of platform-fee payments.
// Each row represents one payment made by a shop owner toward their
// 5% platform-fee balance, settling all unbilled orders before
// covers_until.
type FeePaymentRepository interface {
	// RecordPayment inserts a payment row and returns the populated payment.
	RecordPayment(ctx context.Context, p *domain.ShopFeePayment) error

	// LastPaymentForShop returns the most recent payment for a shop, or nil
	// if the shop has never paid. Used to compute outstanding balance.
	LastPaymentForShop(ctx context.Context, shopID string) (*domain.ShopFeePayment, error)

	// LastPaymentsForAllShops returns the latest payment per shop, keyed by shop_id.
	// Used to compute the per-shop fee status snapshot in one query.
	LastPaymentsForAllShops(ctx context.Context) (map[string]*domain.ShopFeePayment, error)

	// CollectedBetween returns the total fees collected across all shops in
	// the given window (inclusive start, exclusive end).
	CollectedBetween(ctx context.Context, start, end time.Time) (string, error)

	// History returns payments for a shop, newest first.
	History(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error)
}
