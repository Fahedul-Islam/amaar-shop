package domain

import "errors"

// PlatformStats are the headline numbers on the admin overview page.
// Money fields are decimal strings to preserve precision through JSON.
type PlatformStats struct {
	TotalShops     int    `json:"total_shops"`
	ActiveShops    int    `json:"active_shops"`
	SuspendedShops int    `json:"suspended_shops"`
	TotalUsers     int    `json:"total_users"`
	TotalProducts  int    `json:"total_products"`
	TotalOrders    int    `json:"total_orders"`
	OrdersToday    int    `json:"orders_today"`
	GMVAllTime     string `json:"gmv_all_time"`
	GMV30d         string `json:"gmv_30d"`
	NewShops7d     int    `json:"new_shops_7d"`
	PendingOrders  int    `json:"pending_orders"`
}

// AdminShopRow is a shop row enriched with owner email and aggregate counts
// used by the admin shops list and detail view.
type AdminShopRow struct {
	Shop
	OwnerEmail   string `json:"owner_email"`
	ProductCount int    `json:"product_count"`
	OrderCount   int    `json:"order_count"`
	RevenueBDT   string `json:"revenue_bdt"`
}

// AdminUserRow enriches a user row with shop-owner info and order activity.
type AdminUserRow struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	IsAdmin    bool   `json:"is_admin"`
	IsOwner    bool   `json:"is_owner"`
	ShopName   string `json:"shop_name,omitempty"`
	ShopSlug   string `json:"shop_slug,omitempty"`
	OrderCount int    `json:"order_count"`
	SpentBDT   string `json:"spent_bdt"`
	CreatedAt  string `json:"created_at"`
}

// AdminOrderRow enriches an order with shop name and slug for cross-shop views.
type AdminOrderRow struct {
	ID            string `json:"id"`
	ShopID        string `json:"shop_id"`
	ShopName      string `json:"shop_name"`
	ShopSlug      string `json:"shop_slug"`
	CustomerName  string `json:"customer_name"`
	CustomerPhone string `json:"customer_phone"`
	DeliveryArea  string `json:"delivery_area"`
	TotalBDT      string `json:"total_bdt"`
	Status        string `json:"status"`
	CreatedAt     string `json:"created_at"`
}

// AdminProductRow enriches a product with shop info for moderation lists.
type AdminProductRow struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ShopID     string `json:"shop_id"`
	ShopName   string `json:"shop_name"`
	ShopSlug   string `json:"shop_slug"`
	PriceBDT   string `json:"price_bdt"`
	Stock      int    `json:"stock"`
	IsActive   bool   `json:"is_active"`
	IsArchived bool   `json:"is_archived"`
	ImageURL   string `json:"image_url"`
	CreatedAt  string `json:"created_at"`
}

// AdminOverview bundles the home-page widgets so the dashboard hydrates in one round-trip.
type AdminOverview struct {
	Stats       *PlatformStats `json:"stats"`
	RecentShops []AdminShopRow `json:"recent_shops"`
	TopShops    []AdminShopRow `json:"top_shops"`
}

// AdminListFilter is the standard filter shape for paginated admin lists.
type AdminListFilter struct {
	Status string
	Role   string // users only
	Query  string
	Page   int
	PageSize int
}

// Offset returns the SQL offset corresponding to the page/page_size pair.
func (f AdminListFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.PageSize
}

var (
	ErrAdminAccessRequired = errors.New("admin access required")
	// ErrCannotDemoteSelf protects against an admin removing their own
	// admin flag and locking themselves out.
	ErrCannotDemoteSelf = errors.New("you cannot remove your own admin access")
	// ErrCannotChangeOwnerOfActiveShop is reserved for future use when we
	// allow promoting/demoting shop owners through the admin UI.
)

// PlatformFeeRate is the cut AmaarShop takes from every non-cancelled order.
// Settings UI can change this in a later iteration; for now it's a constant.
const PlatformFeeRate = 0.05

// ----- Analytics report (Insights page) ------------------------------------

// PeriodMetric pairs a current value with its previous-period equivalent so
// the UI can show "↑ 14% vs prev period" without doing the math itself.
type PeriodMetric struct {
	Current  string   `json:"current"`             // decimal string for money, integer string otherwise
	Previous string   `json:"previous"`
	Pct      *float64 `json:"change_pct,omitempty"` // null when previous == 0 (undefined %)
}

// DailyPoint is a single bucket in a time series ("orders per day", "new
// customers per day"). Date is the bucket boundary in YYYY-MM-DD form.
type DailyPoint struct {
	Date  string `json:"date"`
	Value string `json:"value"` // string so money points keep precision
}

// CategoryBreakdown ranks categories by the GMV they contributed in the period.
type CategoryBreakdown struct {
	Name       string  `json:"name"`
	GMVBdt     string  `json:"gmv_bdt"`
	Percentage float64 `json:"percentage"`
}

// TopProductRow ranks products by units sold in the period.
type TopProductRow struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ShopName   string `json:"shop_name"`
	UnitsSold  int    `json:"units_sold"`
	GMVBdt     string `json:"gmv_bdt"`
	ImageURL   string `json:"image_url"`
}

// GeoBreakdown groups orders by delivery area for the geo-distribution widget.
type GeoBreakdown struct {
	Area       string  `json:"area"`
	Orders     int     `json:"orders"`
	Percentage float64 `json:"percentage"`
}

// AnalyticsReport bundles everything the Insights page needs in one round-trip.
type AnalyticsReport struct {
	Days int `json:"days"`

	GMV          PeriodMetric `json:"gmv_bdt"`
	Orders       PeriodMetric `json:"orders"`
	NewCustomers PeriodMetric `json:"new_customers"`
	NewShops     PeriodMetric `json:"new_shops"`
	AOV          PeriodMetric `json:"avg_order_value_bdt"`

	OrdersDaily       []DailyPoint        `json:"orders_daily"`
	NewCustomersDaily []DailyPoint        `json:"new_customers_daily"`
	TopCategories     []CategoryBreakdown `json:"top_categories"`
	TopProducts       []TopProductRow     `json:"top_products"`
	Geographic        []GeoBreakdown      `json:"geographic"`
}

// ----- Financial report (Money & payouts page) -----------------------------

// RevenueSplit shows how the platform's GMV is divided between the shops
// (paid to owners) and AmaarShop (platform fee).
type RevenueSplit struct {
	ToShopsBDT     string  `json:"to_shops_bdt"`
	PlatformFeeBDT string  `json:"platform_fee_bdt"`
	ShopsPct       float64 `json:"to_shops_pct"`
	FeePct         float64 `json:"platform_fee_pct"`
}

// ShopPayout is one shop's pending earnings for the period.
// "Pending" = orders that have been placed and not cancelled, since AmaarShop
// has no real payout/settlement system yet — the number reflects what we'd
// owe the shop if we cut a check today.
type ShopPayout struct {
	ShopID    string `json:"shop_id"`
	ShopName  string `json:"shop_name"`
	ShopSlug  string `json:"shop_slug"`
	Orders    int    `json:"orders"`
	GrossBDT  string `json:"gross_bdt"`
	FeeBDT    string `json:"fee_bdt"`
	NetBDT    string `json:"net_bdt"`
}

// FinancialReport bundles money-and-payouts data for the admin financial page.
type FinancialReport struct {
	Days int `json:"days"`

	GMV             PeriodMetric `json:"gmv_bdt"`
	PlatformFee     PeriodMetric `json:"platform_fee_bdt"`
	PendingPayouts  string       `json:"pending_payouts_bdt"`  // outstanding to shops right now
	PendingPayoutCount int       `json:"pending_payout_count"` // how many shops have any pending earnings
	Refunds         PeriodMetric `json:"refunds_bdt"`          // sum of cancelled order totals

	GMVDaily        []DailyPoint   `json:"gmv_daily"`
	RevenueSplit    RevenueSplit   `json:"revenue_split"`
	UpcomingPayouts []ShopPayout   `json:"upcoming_payouts"`
}

// ----- Admin team (Roles & access page) ------------------------------------

// AdminTeamMember describes one admin account on the team page.
// Roles in this MVP are limited to "Admin" vs "Super admin" (the seeded one),
// but we expose an open `role` string so the UI stays compatible if we ever
// introduce moderator/support tiers.
type AdminTeamMember struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Role         string `json:"role"`           // "Super admin" | "Admin"
	IsSuperAdmin bool   `json:"is_super_admin"` // first admin == super admin in this MVP
	CreatedAt    string `json:"created_at"`
}

