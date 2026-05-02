package service

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AdminService implements the platform-admin operations: cross-shop
// reporting, shop suspension, product moderation, and platform-fee
// settlement. Authorization (verifying users.is_admin) is enforced once
// at the handler boundary — methods here assume the caller has already
// passed that gate.
type AdminService struct {
	admin    repository.AdminRepository
	users    repository.UserRepository
	fees     repository.FeePaymentRepository
	feeRule  repository.FeeRuleRepository
}

func NewAdminService(
	admin repository.AdminRepository,
	users repository.UserRepository,
	fees repository.FeePaymentRepository,
	feeRule repository.FeeRuleRepository,
) *AdminService {
	return &AdminService{admin: admin, users: users, fees: fees, feeRule: feeRule}
}

// IsAdmin returns true if the given user has admin privileges.
// Used by the handler middleware to gate every /api/admin/* request.
func (s *AdminService) IsAdmin(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return user.IsAdmin, nil
}

// PlatformStats returns the headline overview numbers.
func (s *AdminService) PlatformStats(ctx context.Context) (*domain.PlatformStats, error) {
	return s.admin.PlatformStats(ctx)
}

// Overview bundles the home-page widgets (stats + recent shops + top shops)
// so the dashboard hydrates in one round-trip.
func (s *AdminService) Overview(ctx context.Context) (*domain.AdminOverview, error) {
	stats, err := s.admin.PlatformStats(ctx)
	if err != nil {
		return nil, err
	}
	recent, err := s.admin.RecentShops(ctx, 6)
	if err != nil {
		return nil, err
	}
	top, err := s.admin.TopShops(ctx, 30, 5)
	if err != nil {
		return nil, err
	}
	return &domain.AdminOverview{
		Stats:       stats,
		RecentShops: recent,
		TopShops:    top,
	}, nil
}

// ListShops returns paginated shops with admin-only filters.
// The filter is normalized so callers can pass raw query params.
func (s *AdminService) ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error) {
	return s.admin.ListShops(ctx, normalizeFilter(f))
}

// GetShop returns a single shop with admin-enriched fields.
func (s *AdminService) GetShop(ctx context.Context, shopID string) (*domain.AdminShopRow, error) {
	return s.admin.ShopByID(ctx, shopID)
}

// SetShopSuspended flips a shop's suspension flag and returns the refreshed row.
// Re-fetching after the update keeps clients consistent with whatever
// other fields are computed live (counts, revenue).
func (s *AdminService) SetShopSuspended(ctx context.Context, shopID string, suspended bool) (*domain.AdminShopRow, error) {
	if err := s.admin.SetShopSuspended(ctx, shopID, suspended); err != nil {
		return nil, err
	}
	return s.admin.ShopByID(ctx, shopID)
}

// ListUsers returns paginated users.
func (s *AdminService) ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error) {
	return s.admin.ListUsers(ctx, normalizeFilter(f))
}

// ListOrders returns cross-shop orders.
func (s *AdminService) ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error) {
	return s.admin.ListOrders(ctx, normalizeFilter(f))
}

// ListProducts returns cross-shop products for moderation.
func (s *AdminService) ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error) {
	return s.admin.ListProducts(ctx, normalizeFilter(f))
}

// SetProductActive toggles a product's visibility.
func (s *AdminService) SetProductActive(ctx context.Context, productID string, active bool) error {
	return s.admin.SetProductActive(ctx, productID, active)
}

// AnalyticsReport returns the trailing-window insights snapshot.
func (s *AdminService) AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error) {
	return s.admin.AnalyticsReport(ctx, days)
}

// FinancialReport returns the money-and-payouts snapshot. It looks up the
// current fee rule first so all per-shop and aggregate fee numbers are
// computed against the same rule.
func (s *AdminService) FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error) {
	rule, err := s.feeRule.Get(ctx)
	if err != nil {
		return nil, err
	}
	return s.admin.FinancialReport(ctx, days, rule)
}

// FeeRule returns the current platform fee rule.
func (s *AdminService) FeeRule(ctx context.Context) (*domain.FeeRule, error) {
	return s.feeRule.Get(ctx)
}

// UpdateFeeRule writes a new rule. Validates type + value before persisting.
// Percentage values are clamped to [0, 100] for sanity.
func (s *AdminService) UpdateFeeRule(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error) {
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
	return s.feeRule.Update(ctx, in)
}

// ListAdmins returns every admin team member.
func (s *AdminService) ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error) {
	return s.admin.ListAdmins(ctx)
}

// SetUserAdmin promotes or demotes a user. Refuses self-demotion to avoid
// the lockout trap where the only admin removes their own access.
func (s *AdminService) SetUserAdmin(ctx context.Context, callerID, targetID string, isAdmin bool) error {
	if !isAdmin && callerID == targetID {
		return domain.ErrCannotDemoteSelf
	}
	return s.admin.SetUserAdmin(ctx, targetID, isAdmin)
}

// RecordFeePayment registers a payment from a shop owner toward their
// outstanding 5% platform-fee balance. The admin records this manually
// after receiving payment via bKash / bank transfer / cash.
//
// covers_until is required and must not be in the future — it sets the
// upper bound on which orders this payment settles. If left zero, the
// service stamps it as "now" so future calls treat all current unbilled
// orders as paid.
func (s *AdminService) RecordFeePayment(ctx context.Context, in domain.RecordFeePaymentInput) (*domain.ShopFeePayment, error) {
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
	if _, err := s.admin.ShopByID(ctx, in.ShopID); err != nil {
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
func (s *AdminService) FeePaymentHistory(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error) {
	return s.fees.History(ctx, shopID, limit)
}

// normalizeFilter clamps page/page_size to safe defaults.
func normalizeFilter(f domain.AdminListFilter) domain.AdminListFilter {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 || f.PageSize > 200 {
		f.PageSize = 25
	}
	return f
}
