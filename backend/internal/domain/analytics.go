package domain

// TodayStats holds aggregate statistics for the current day.
type TodayStats struct {
	TotalOrders   int    `json:"total_orders"`
	PendingOrders int    `json:"pending_orders"`
	RevenueBDT    string `json:"revenue_bdt"`
	Date          string `json:"date"`
}

// DayStat is a single row in a date-range time series.
type DayStat struct {
	Date       string `json:"date"`
	Orders     int    `json:"orders"`
	RevenueBDT string `json:"revenue_bdt"`
}

// TopProduct represents a best-selling product within a period.
type TopProduct struct {
	ProductID       string `json:"product_id"`
	ProductName     string `json:"product_name"`
	TotalQuantity   int    `json:"total_quantity"`
	TotalRevenueBDT string `json:"total_revenue_bdt"`
}

// PeriodSummary holds aggregate metrics for a single date window.
type PeriodSummary struct {
	StartDate    string  `json:"start_date"`
	EndDate      string  `json:"end_date"`
	RevenueBDT   string  `json:"revenue_bdt"`
	Orders       int     `json:"orders"`
	AOVBDT       string  `json:"aov_bdt"`
	TotalVisits  int     `json:"total_visits"`
	UniqueVisits int     `json:"unique_visits"`
	OrderRate    float64 `json:"order_rate"`
}

// SummaryChanges holds percentage changes between two PeriodSummary values.
// nil pointers signal "no comparable previous value" (e.g. division by zero).
type SummaryChanges struct {
	RevenuePct      *float64 `json:"revenue_pct"`
	OrdersPct       *float64 `json:"orders_pct"`
	AOVPct          *float64 `json:"aov_pct"`
	TotalVisitsPct  *float64 `json:"total_visits_pct"`
	UniqueVisitsPct *float64 `json:"unique_visits_pct"`
	OrderRatePct    *float64 `json:"order_rate_pct"`
}

// StatsSummaryResult bundles a current period's summary with an optional
// comparison period and the percentage changes between them.
type StatsSummaryResult struct {
	Current  PeriodSummary   `json:"current"`
	Previous *PeriodSummary  `json:"previous,omitempty"`
	Changes  *SummaryChanges `json:"changes,omitempty"`
}

// LowStockProduct surfaces a single product nearing or at zero inventory.
type LowStockProduct struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Stock int    `json:"stock"`
	// PriceBDT is the price the buyer pays — useful so the seller can sort
	// reorder priority by potential lost revenue.
	PriceBDT string `json:"price_bdt"`
}

// DashboardSummary is everything the dashboard home page needs in one
// round-trip. Composed at the service layer from multiple repositories.
type DashboardSummary struct {
	// Action queue — counts the seller should clear today.
	PendingOrdersCount     int `json:"pending_orders_count"`
	AwaitingAdvanceCount   int `json:"awaiting_advance_count"`
	UnansweredReviewsCount int `json:"unanswered_reviews_count"`
	OutOfStockCount        int `json:"out_of_stock_count"`
	LowStockCount          int `json:"low_stock_count"`

	// Cash flow snapshot (defaults to today / last 7 days).
	TodayRevenueBDT     string `json:"today_revenue_bdt"`
	TodayOrders         int    `json:"today_orders"`
	InTransitOrders     int    `json:"in_transit_orders"`     // status='shipped'
	InTransitAmountBDT  string `json:"in_transit_amount_bdt"` // sum of those totals
	DeliveredWeekOrders int    `json:"delivered_week_orders"` // last 7 days
	DeliveredWeekBDT    string `json:"delivered_week_bdt"`

	// Top low-stock products to act on.
	LowStockProducts []LowStockProduct `json:"low_stock_products"`
}
