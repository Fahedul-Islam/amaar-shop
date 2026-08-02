package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// The admin queries are split into role interfaces because their consumers
// want very different slices: moderation screens write, reporting screens
// only read aggregates, and the seller billing page needs exactly one lookup.
// Every method is platform-wide (no tenant scoping) — the caller is
// responsible for verifying the requester's admin status before invoking any
// of these.

// AdminShopLookup resolves a single admin-enriched shop row. Split out so
// callers that only need to confirm a shop exists (fee settlement) don't
// depend on the whole moderation surface.
type AdminShopLookup interface {
	// ShopByID returns a single admin-enriched shop row, or ErrShopNotFound.
	ShopByID(ctx context.Context, shopID string) (*domain.AdminShopRow, error)
}

// AdminModerationRepository serves the cross-shop listing screens and the
// moderation actions an admin can take from them.
type AdminModerationRepository interface {
	AdminShopLookup

	// ListShops returns paginated shops enriched with owner + activity counts.
	ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error)

	// SetShopSuspended flips the suspension flag, returning ErrShopNotFound on miss.
	SetShopSuspended(ctx context.Context, shopID string, suspended bool) error

	// ListUsers returns paginated users with shop-owner enrichment.
	ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error)

	// ListOrders returns cross-shop orders.
	ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error)

	// ListProducts returns cross-shop products for moderation.
	ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error)

	// SetProductActive toggles a product's visibility flag (any shop).
	SetProductActive(ctx context.Context, productID string, active bool) error
}

// AdminInsightsRepository is the read-only reporting surface behind the
// admin overview and insights pages.
type AdminInsightsRepository interface {
	// PlatformStats returns the aggregate headline numbers for the overview page.
	PlatformStats(ctx context.Context) (*domain.PlatformStats, error)

	// RecentShops returns the N newest shops (admin "new shops" widget).
	RecentShops(ctx context.Context, limit int) ([]domain.AdminShopRow, error)

	// TopShops returns the top shops by order volume in the trailing window.
	TopShops(ctx context.Context, days, limit int) ([]domain.AdminShopRow, error)

	// AnalyticsReport returns the full insights snapshot for the trailing
	// `days` window. Comparison numbers are computed against the equivalent
	// preceding window of the same length.
	AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error)

	// FinancialReport returns money-and-payouts data for the trailing window.
	// The rule is applied at the repo layer so per-shop fee numbers stay
	// consistent across all queries that compute "what shops owe".
	FinancialReport(ctx context.Context, days int, rule *domain.FeeRule) (*domain.FinancialReport, error)
}

// AdminTeamRepository owns who holds admin privileges.
type AdminTeamRepository interface {
	// ListAdmins returns every user with is_admin = true, ordered by oldest first
	// so the seeded "super admin" sorts to the top.
	ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error)

	// SetUserAdmin promotes or demotes a user. Returns ErrUserNotFound on miss.
	SetUserAdmin(ctx context.Context, userID string, isAdmin bool) error
}

// ShopFeeQueries exposes the unbilled-balance lookup the seller's own billing
// page needs, without dragging in the platform-admin surface around it.
type ShopFeeQueries interface {
	// UnbilledForShop returns (orderCount, gmvBdt) for the trailing window
	// since the shop's last fee payment (or all-time if never paid).
	UnbilledForShop(ctx context.Context, shopID string) (int, string, error)
}

// AdminRepository is the full set of cross-table admin queries, composed from
// the roles above. It documents what the postgres implementation provides;
// consumers should depend on the narrowest role that covers their use.
type AdminRepository interface {
	AdminModerationRepository
	AdminInsightsRepository
	AdminTeamRepository
	ShopFeeQueries
}
