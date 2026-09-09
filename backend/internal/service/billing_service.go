package service

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// BillingService owns the seller-side billing flow: looking up what a shop
// owes (using the current rule), submitting a payment claim, and the admin
// review of those claims. PlatformFeeService keeps owning the rule itself and
// the admin-recorded settlements against it.
type BillingService struct {
	rules    repository.FeeRuleRepository
	subs     repository.FeeSubmissionRepository
	feePays  repository.FeePaymentRepository
	shops    repository.ShopRepository
	unbilled repository.ShopFeeQueries
}

func NewBillingService(
	rules repository.FeeRuleRepository,
	subs repository.FeeSubmissionRepository,
	feePays repository.FeePaymentRepository,
	shops repository.ShopRepository,
	unbilled repository.ShopFeeQueries,
) *BillingService {
	return &BillingService{
		rules: rules, subs: subs, feePays: feePays, shops: shops, unbilled: unbilled,
	}
}

// MyBillingSnapshot is what the seller sees on their billing page. It bundles:
//
//   - the current fee rule (so the seller can read it as "5% of sales" or
//     "৳10 per order")
//   - what they owe right now (computed from the rule × unbilled orders)
//   - last-paid-at + days since
//   - whether they have a submission already pending review
//   - their last 10 submissions for status visibility
func (s *BillingService) MyBillingSnapshot(ctx context.Context, ownerUserID string) (*domain.ShopBillingSnapshot, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	rule, err := s.rules.ForShop(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	balance, err := s.rules.Balance(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	lastPay, err := s.feePays.LastPaymentForShop(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	hasPending, err := s.subs.HasPending(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	recent, err := s.subs.RecentForShop(ctx, shop.ID, 10)
	if err != nil {
		return nil, err
	}

	snap := &domain.ShopBillingSnapshot{
		Rule:              *rule,
		UnbilledOrders:    balance.Orders,
		UnbilledGMVBDT:    balance.GMV,
		OutstandingFeeBDT: balance.Due,
		ChargedBDT:        balance.Charged, PaidBDT: balance.Paid, CreditBDT: balance.Credit, Items: balance.Items,
		HasPendingSubmission: hasPending,
		RecentSubmissions:    recent,
	}

	owed, _ := strconv.ParseFloat(snap.OutstandingFeeBDT, 64)
	cycle := time.Duration(domain.FeeBillingCycleDays) * 24 * time.Hour
	now := time.Now()
	switch {
	case owed < 0.005:
		snap.Status = domain.FeeStatusPaidUp
	case lastPay != nil && now.Sub(lastPay.CreatedAt) > cycle:
		snap.Status = domain.FeeStatusOverdue
	default:
		snap.Status = domain.FeeStatusDue
	}
	if lastPay != nil {
		ts := lastPay.CreatedAt.Format(time.RFC3339)
		snap.LastPaidAt = &ts
		days := int(now.Sub(lastPay.CreatedAt).Hours() / 24)
		snap.DaysSinceLastPaid = &days
	}
	return snap, nil
}

// SubmitPayment records a seller's claim that they paid the platform fee.
// Validates the payload, then persists a "pending" submission for admin
// review. Refuses if the shop already has an in-flight submission — the
// admin should act on the previous one first.
func (s *BillingService) SubmitPayment(ctx context.Context, ownerUserID string, in domain.CreateFeeSubmissionInput) (*domain.FeeSubmission, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	if !domain.IsValidPaymentMethod(in.PaymentMethod) {
		return nil, domain.ErrInvalidPaymentMethod
	}
	if strings.TrimSpace(in.TransactionID) == "" {
		return nil, domain.ErrTransactionIDRequired
	}
	amt, err := strconv.ParseFloat(in.AmountBDT, 64)
	if err != nil || amt < 0.01 || math.IsNaN(amt) || math.IsInf(amt, 0) || amt > 9999999999.99 {
		return nil, domain.ErrInvalidPaymentAmount
	}

	pending, err := s.subs.HasPending(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	if pending {
		return nil, domain.ErrPendingSubmissionExists
	}

	sub := &domain.FeeSubmission{
		ShopID:        shop.ID,
		AmountBDT:     strconv.FormatFloat(amt, 'f', 2, 64),
		PaymentMethod: domain.PaymentMethod(in.PaymentMethod),
		TransactionID: strings.TrimSpace(in.TransactionID),
		SenderAccount: strings.TrimSpace(in.SenderAccount),
		Note:          strings.TrimSpace(in.Note),
	}
	if err := s.subs.Create(ctx, sub); err != nil {
		return nil, err
	}
	return sub, nil
}

// MySubmissions returns the seller's own submission history.
func (s *BillingService) MySubmissions(ctx context.Context, ownerUserID string, limit int) ([]domain.FeeSubmission, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.subs.RecentForShop(ctx, shop.ID, limit)
}

// ----- Admin-side review ---------------------------------------------------

// ListSubmissions returns the admin review queue.
func (s *BillingService) ListSubmissions(ctx context.Context, f domain.FeeSubmissionListFilter) ([]domain.AdminFeeSubmissionRow, int, error) {
	if f.PageSize <= 0 || f.PageSize > 200 {
		f.PageSize = 25
	}
	if f.Page < 1 {
		f.Page = 1
	}
	return s.subs.List(ctx, f)
}

// SubmissionCounts returns counts grouped by status — for tab badges.
func (s *BillingService) SubmissionCounts(ctx context.Context) (map[string]int, error) {
	return s.subs.CountByStatus(ctx)
}

// FindSubmission returns one submission joined with shop info.
func (s *BillingService) FindSubmission(ctx context.Context, id string) (*domain.AdminFeeSubmissionRow, error) {
	return s.subs.FindByID(ctx, id)
}

// ApproveSubmission marks a submission as approved and creates the
// corresponding shop_fee_payments row, settling the shop's outstanding
// balance up to CoversUntil. The amount used for the payment row is the
// seller-claimed AmountBDT — admins should reject and ask the seller to
// resubmit if the amount is wrong.
//
// CoversUntil defaults to "now" so the payment immediately settles all
// currently-unbilled orders.
func (s *BillingService) ApproveSubmission(ctx context.Context, in domain.ReviewFeeSubmissionInput) (*domain.AdminFeeSubmissionRow, error) {
	if err := s.subs.Approve(ctx, in.SubmissionID, in.AdminFeedback, in.AdminUserID); err != nil {
		return nil, err
	}

	return s.subs.FindByID(ctx, in.SubmissionID)
}

// RejectSubmission marks a submission as rejected with admin feedback.
// No fee payment is recorded; the shop's balance is unchanged.
func (s *BillingService) RejectSubmission(ctx context.Context, in domain.ReviewFeeSubmissionInput) (*domain.AdminFeeSubmissionRow, error) {
	if err := s.subs.MarkRejected(ctx, in.SubmissionID, in.AdminFeedback, in.AdminUserID); err != nil {
		return nil, err
	}
	return s.subs.FindByID(ctx, in.SubmissionID)
}
