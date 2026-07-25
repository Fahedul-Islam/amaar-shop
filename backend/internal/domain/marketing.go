package domain

import (
	"errors"
	"time"
)

// BDLocation is Bangladesh Standard Time (UTC+6). Every seller-facing date
// boundary ("today", a report range, which day a spend belongs to) must be
// computed in this zone rather than UTC — otherwise between midnight and 6am
// local time the server's idea of "today" lags the seller's by a day.
var BDLocation = time.FixedZone("BST", 6*60*60)

// TodayBD returns the current date in Bangladesh as YYYY-MM-DD.
func TodayBD() string {
	return time.Now().In(BDLocation).Format("2006-01-02")
}

// AdPlatforms are the ad channels a seller can log spend against.
var AdPlatforms = []string{"facebook", "tiktok", "instagram", "google", "other"}

// IsValidAdPlatform reports whether p is a supported ad platform.
func IsValidAdPlatform(p string) bool {
	for _, valid := range AdPlatforms {
		if p == valid {
			return true
		}
	}
	return false
}

// AdSpend is one day's advertising spend on one platform for a shop.
// Entered manually by the seller — a courier/marketing API import can later
// populate the same rows without changing anything downstream.
type AdSpend struct {
	ID        string    `json:"id"`
	ShopID    string    `json:"shop_id"`
	SpendDate string    `json:"spend_date"` // YYYY-MM-DD
	Platform  string    `json:"platform"`
	AmountBDT string    `json:"amount_bdt"`
	Note      string    `json:"note,omitempty"`
	// IsEstimated marks a row auto-filled from the shop's daily budget rather
	// than confirmed by the seller.
	IsEstimated bool      `json:"is_estimated"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AdBudget is a shop's recurring daily spend on one platform. A background
// job turns it into AdSpend rows so the seller never types a daily figure.
type AdBudget struct {
	ShopID         string    `json:"shop_id"`
	Platform       string    `json:"platform"`
	DailyAmountBDT string    `json:"daily_amount_bdt"`
	IsActive       bool      `json:"is_active"`
	StartsOn       string    `json:"starts_on"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// PlatformSpend is the total spent on one platform within a period.
type PlatformSpend struct {
	Platform  string `json:"platform"`
	AmountBDT string `json:"amount_bdt"`
}

// ProfitSummary is the unit-economics picture for a date range: what actually
// landed (delivered revenue), what the goods cost, what was spent on ads, and
// the derived ratios a seller needs to decide whether to scale or cut a campaign.
//
// Money that hasn't been delivered is deliberately excluded from revenue: for
// cash-on-delivery a pending or shipped order is not yet income, and a returned
// one never will be.
type ProfitSummary struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`

	// Order counts by outcome.
	TotalOrders     int `json:"total_orders"` // excludes cancelled
	DeliveredOrders int `json:"delivered_orders"`
	ReturnedOrders  int `json:"returned_orders"`
	InFlightOrders  int `json:"in_flight_orders"` // pending/confirmed/shipped

	// Money.
	DeliveredRevenueBDT string `json:"delivered_revenue_bdt"` // realised income
	BookedRevenueBDT    string `json:"booked_revenue_bdt"`    // incl. not-yet-delivered
	COGSBDT             string `json:"cogs_bdt"`              // cost of delivered goods
	GrossProfitBDT      string `json:"gross_profit_bdt"`      // delivered revenue - COGS
	AdSpendBDT          string `json:"ad_spend_bdt"`
	NetProfitBDT        string `json:"net_profit_bdt"` // gross profit - ad spend

	// Ratios. Pointers are nil when the input is zero (undefined, not 0.0).
	GrossMarginPct    *float64 `json:"gross_margin_pct"`     // gross profit / delivered revenue
	ROAS              *float64 `json:"roas"`                 // delivered revenue / ad spend
	BreakEvenROAS     *float64 `json:"break_even_roas"`      // 1 / gross margin
	CostPerOrderBDT   *string  `json:"cost_per_order_bdt"`   // ad spend / total orders
	CACDeliveredBDT   *string  `json:"cac_delivered_bdt"`    // ad spend / delivered orders
	DeliverySuccessPct *float64 `json:"delivery_success_pct"` // delivered / (delivered + returned)
	AOVBDT            *string  `json:"aov_bdt"`              // delivered revenue / delivered orders
	ProfitPerOrderBDT *string  `json:"profit_per_order_bdt"` // net profit / delivered orders

	// Data-quality signal: delivered line items with no cost price recorded.
	// When > 0 the COGS (and therefore profit) figure understates the truth.
	ItemsMissingCost int `json:"items_missing_cost"`

	// EstimatedSpendBDT is the portion of AdSpendBDT that was auto-filled from
	// a daily budget rather than confirmed, so the UI can flag it.
	EstimatedSpendBDT string `json:"estimated_spend_bdt"`

	SpendByPlatform []PlatformSpend `json:"spend_by_platform"`
}

// ProductProfit is per-product unit economics over a period, used to decide
// which products deserve more ad budget.
type ProductProfit struct {
	ProductID      string   `json:"product_id"`
	ProductName    string   `json:"product_name"`
	UnitsDelivered int      `json:"units_delivered"`
	RevenueBDT     string   `json:"revenue_bdt"`
	COGSBDT        string   `json:"cogs_bdt"`
	ProfitBDT      string   `json:"profit_bdt"`
	MarginPct      *float64 `json:"margin_pct"`
	HasCost        bool     `json:"has_cost"`
}

var (
	ErrInvalidAdPlatform = errors.New("invalid ad platform")
	ErrInvalidAdAmount   = errors.New("ad spend amount must be zero or greater")
	ErrInvalidSpendDate  = errors.New("spend date must be a valid YYYY-MM-DD date")
	ErrAdSpendNotFound   = errors.New("ad spend entry not found")
	ErrInvalidCostPrice  = errors.New("cost price must be zero or greater")
)
