package domain

import (
	"errors"
	"time"
)

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
	Status   string
	Role     string // users only
	Query    string
	Page     int
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
	Current  string   `json:"current"` // decimal string for money, integer string otherwise
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
	ID        string `json:"id"`
	Name      string `json:"name"`
	ShopName  string `json:"shop_name"`
	UnitsSold int    `json:"units_sold"`
	GMVBdt    string `json:"gmv_bdt"`
	ImageURL  string `json:"image_url"`
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
//
// Money model: AmaarShop is COD-first. Cash flows direct from buyer to shop.
// The shop owner then owes AmaarShop a 5% platform fee, billed every 14 days.
// So all financial reporting is framed as "fees collected" / "fees still owed
// by shops to the platform" — never the other way around.

// FeeBillingCycleDays is how often a shop is expected to settle its
// platform-fee balance with AmaarShop.
const FeeBillingCycleDays = 14

// FeeStatus describes where one shop stands on its current fee balance.
type FeeStatus string

const (
	FeeStatusPaidUp  FeeStatus = "paid_up" // no outstanding balance
	FeeStatusDue     FeeStatus = "due"     // balance owed, within current 14-day window
	FeeStatusOverdue FeeStatus = "overdue" // balance owed, last payment > 14 days ago (or never)
)

// ShopFeeStatus is one shop's current fee picture. It's computed live from
// orders + payments — there's no "invoice" entity. The UI uses it to render
// "shop X owes ৳Y, last paid Z days ago".
type ShopFeeStatus struct {
	ShopID   string `json:"shop_id"`
	ShopName string `json:"shop_name"`
	ShopSlug string `json:"shop_slug"`

	UnbilledOrders    int    `json:"unbilled_orders"` // orders since last payment (period start)
	UnbilledGMVBDT    string `json:"unbilled_gmv_bdt"`
	OutstandingFeeBDT string `json:"outstanding_fee_bdt"` // 5% × UnbilledGMV

	LastPaidAt        *string `json:"last_paid_at,omitempty"`         // ISO8601, nil if never paid
	LastPaidAmountBDT string  `json:"last_paid_amount_bdt,omitempty"` // amount of the last payment
	DaysSinceLastPaid *int    `json:"days_since_last_paid,omitempty"` // nil if never paid

	Status FeeStatus `json:"status"`
}

// FinancialReport bundles fee-collection data for the admin financial page.
type FinancialReport struct {
	Days int `json:"days"`

	// Window-scoped metrics:
	GMV           PeriodMetric `json:"gmv_bdt"`            // total order value processed by all shops
	PlatformFee   PeriodMetric `json:"platform_fee_bdt"`   // 5% of GMV — what the platform earned in this window
	FeesCollected PeriodMetric `json:"fees_collected_bdt"` // sum of shop_fee_payments rows in window
	Refunds       PeriodMetric `json:"refunds_bdt"`        // cancelled order totals (informational)

	// Live cross-window snapshots:
	OutstandingFeesBDT       string `json:"outstanding_fees_bdt"`        // total still owed by all shops right now
	ShopsWithOutstandingFees int    `json:"shops_with_outstanding_fees"` // count of shops with > 0 owed
	ShopsOverdue             int    `json:"shops_overdue"`               // count whose last_paid_at + 14d has passed

	GMVDaily []DailyPoint    `json:"gmv_daily"`
	ShopFees []ShopFeeStatus `json:"shop_fees"`
}

// RecordFeePaymentInput is the admin-supplied payload for marking a shop's
// outstanding fees as paid.
type RecordFeePaymentInput struct {
	ShopID      string
	AmountBDT   string
	CoversUntil time.Time // settles all unbilled orders strictly before this
	Note        string
	RecordedBy  string // admin user id
}

// ShopFeePayment is one settlement row.
type ShopFeePayment struct {
	ID          string    `json:"id"`
	ShopID      string    `json:"shop_id"`
	AmountBDT   string    `json:"amount_bdt"`
	CoversUntil time.Time `json:"covers_until"`
	RecordedBy  *string   `json:"recorded_by,omitempty"`
	Note        string    `json:"note,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

var (
	ErrInvalidPaymentAmount = errors.New("payment amount must be greater than zero")
	ErrInvalidCoversUntil   = errors.New("covers_until must be a valid timestamp in the past or now")
)

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
