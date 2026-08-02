package service

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// PlatformFeeService owns the fee rule itself and the admin-recorded
// settlements against it. BillingService owns the seller-facing side of the
// same money flow (what I owe, submitting a claim); this service is what the
// admin uses once the money has actually arrived.
type PlatformFeeService struct {
	rules repository.FeeRuleRepository
	fees  repository.FeePaymentRepository
	shops repository.AdminShopLookup
}

func NewPlatformFeeService(
	rules repository.FeeRuleRepository,
	fees repository.FeePaymentRepository,
	shops repository.AdminShopLookup,
) *PlatformFeeService {
	return &PlatformFeeService{rules: rules, fees: fees, shops: shops}
}

// FeeRule returns the current platform fee rule.
func (s *PlatformFeeService) FeeRule(ctx context.Context) (*domain.FeeRule, error) {
	return s.rules.Get(ctx)
}

// UpdateFeeRule writes a new rule. Validates type + value before persisting.
// Percentage values are clamped to [0, 100] for sanity.
func (s *PlatformFeeService) UpdateFeeRule(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error) {
	if !domain.IsValidFeeRuleType(in.RuleType) {
		return nil, domain.ErrFeeRuleInvalidType
	}
	v, err := strconv.ParseFloat(in.Value, 64)
	if err != nil || v < 0 {
		return nil, domain.ErrFeeRuleInvalidValue
	}
	if domain.FeeRuleType(in.RuleType) == domain.FeeRuleTypePercentage && v > 100 {
		return nil, domain.ErrFeeRulePercentTooBig
	}
	return s.rules.Update(ctx, in)
}

// RecordFeePayment registers a payment from a shop owner toward their
// outstanding platform-fee balance. The admin records this manually
// after receiving payment via bKash / bank transfer / cash.
//
// covers_until is required and must not be in the future — it sets the
// upper bound on which orders this payment settles. If left zero, the
// service stamps it as "now" so future calls treat all current unbilled
// orders as paid.
func (s *PlatformFeeService) RecordFeePayment(ctx context.Context, in domain.RecordFeePaymentInput) (*domain.ShopFeePayment, error) {
	amount, err := strconv.ParseFloat(in.AmountBDT, 64)
	if err != nil || amount <= 0 {
		return nil, domain.ErrInvalidPaymentAmount
	}
	if in.CoversUntil.IsZero() {
		in.CoversUntil = time.Now()
	}
	if in.CoversUntil.After(time.Now().Add(time.Minute)) {
		return nil, domain.ErrInvalidCoversUntil
	}

	// Verify the shop exists before recording. Without this, an admin typo
	// would fail with a generic FK error from postgres.
	if _, err := s.shops.ShopByID(ctx, in.ShopID); err != nil {
		return nil, err
	}

	payment := &domain.ShopFeePayment{
		ShopID:      in.ShopID,
		AmountBDT:   fmt.Sprintf("%.2f", amount),
		CoversUntil: in.CoversUntil,
		Note:        in.Note,
	}
	if in.RecordedBy != "" {
		payment.RecordedBy = &in.RecordedBy
	}
	if err := s.fees.RecordPayment(ctx, payment); err != nil {
		return nil, err
	}
	return payment, nil
}

// FeePaymentHistory returns the most recent payments for a shop.
func (s *PlatformFeeService) FeePaymentHistory(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error) {
	return s.fees.History(ctx, shopID, limit)
}
