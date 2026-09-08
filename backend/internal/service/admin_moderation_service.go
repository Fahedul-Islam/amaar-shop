package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AdminModerationService backs the admin's cross-shop browse-and-act screens:
// listing shops, users, orders and products, and the two moderation levers
// (suspend a shop, hide a product).
//
// Authorization is enforced once at the handler boundary — methods here assume
// the caller has already passed the admin gate.
type AdminModerationService struct {
	repo repository.AdminModerationRepository
}

func NewAdminModerationService(repo repository.AdminModerationRepository) *AdminModerationService {
	return &AdminModerationService{repo: repo}
}

// ListShops returns paginated shops with admin-only filters.
// The filter is normalized so callers can pass raw query params.
func (s *AdminModerationService) ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error) {
	return s.repo.ListShops(ctx, normalizeFilter(f))
}

// GetShop returns a single shop with admin-enriched fields.
func (s *AdminModerationService) GetShop(ctx context.Context, shopID string) (*domain.AdminShopRow, error) {
	return s.repo.ShopByID(ctx, shopID)
}

// SetShopSuspended flips a shop's suspension flag and returns the refreshed row.
// Re-fetching after the update keeps clients consistent with whatever
// other fields are computed live (counts, revenue).
func (s *AdminModerationService) SetShopSuspended(ctx context.Context, shopID string, suspended bool) (*domain.AdminShopRow, error) {
	if err := s.repo.SetShopSuspended(ctx, shopID, suspended); err != nil {
		return nil, err
	}
	return s.repo.ShopByID(ctx, shopID)
}

// ListUsers returns paginated users.
func (s *AdminModerationService) ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error) {
	return s.repo.ListUsers(ctx, normalizeFilter(f))
}

// ListOrders returns cross-shop orders.
func (s *AdminModerationService) ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error) {
	return s.repo.ListOrders(ctx, normalizeFilter(f))
}

// ListProducts returns cross-shop products for moderation.
func (s *AdminModerationService) ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error) {
	return s.repo.ListProducts(ctx, normalizeFilter(f))
}

// SetProductActive toggles a product's visibility.
func (s *AdminModerationService) SetProductActive(ctx context.Context, productID string, active bool) error {
	return s.repo.SetProductActive(ctx, productID, active)
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
