package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AdminService implements the platform-admin operations: cross-shop
// reporting, shop suspension, and product moderation. Authorization
// (verifying users.is_admin) is enforced once at the handler boundary —
// methods on this service assume the caller has already passed that gate.
type AdminService struct {
	admin repository.AdminRepository
	users repository.UserRepository
}

func NewAdminService(admin repository.AdminRepository, users repository.UserRepository) *AdminService {
	return &AdminService{admin: admin, users: users}
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

// FinancialReport returns the money-and-payouts snapshot.
func (s *AdminService) FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error) {
	return s.admin.FinancialReport(ctx, days)
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
