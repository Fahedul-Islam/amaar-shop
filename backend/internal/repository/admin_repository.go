package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// AdminRepository defines the cross-table queries required by platform admins.
// Every method is platform-wide (no tenant scoping) — caller is responsible
// for verifying the requester's admin status before invoking these.
type AdminRepository interface {
	// PlatformStats returns the aggregate headline numbers for the overview page.
	PlatformStats(ctx context.Context) (*domain.PlatformStats, error)

	// ListShops returns paginated shops enriched with owner + activity counts.
	ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error)

	// ShopByID returns a single admin-enriched shop row, or ErrShopNotFound.
	ShopByID(ctx context.Context, shopID string) (*domain.AdminShopRow, error)

	// SetShopSuspended flips the suspension flag, returning ErrShopNotFound on miss.
	SetShopSuspended(ctx context.Context, shopID string, suspended bool) error

	// RecentShops returns the N newest shops (admin "new shops" widget).
	RecentShops(ctx context.Context, limit int) ([]domain.AdminShopRow, error)

	// TopShops returns the top shops by order volume in the trailing window.
	TopShops(ctx context.Context, days, limit int) ([]domain.AdminShopRow, error)

	// ListUsers returns paginated users with shop-owner enrichment.
	ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error)

	// ListOrders returns cross-shop orders.
	ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error)

	// ListProducts returns cross-shop products for moderation.
	ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error)

	// SetProductActive toggles a product's visibility flag (any shop).
	SetProductActive(ctx context.Context, productID string, active bool) error

	// AnalyticsReport returns the full insights snapshot for the trailing
	// `days` window. Comparison numbers are computed against the equivalent
	// preceding window of the same length.
	AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error)

	// FinancialReport returns money-and-payouts data for the trailing window.
	FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error)

	// ListAdmins returns every user with is_admin = true, ordered by oldest first
	// so the seeded "super admin" sorts to the top.
	ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error)

	// SetUserAdmin promotes or demotes a user. Returns ErrUserNotFound on miss.
	SetUserAdmin(ctx context.Context, userID string, isAdmin bool) error
}
