package dto

// TodayStatsDTO is the response for GET /api/shops/me/stats/today.
type TodayStatsDTO struct {
	TotalOrders   int    `json:"total_orders"`
	PendingOrders int    `json:"pending_orders"`
	RevenueBDT    string `json:"revenue_bdt"`
	Date          string `json:"date"`
}

// DayStatDTO is a single row in the range stats response.
type DayStatDTO struct {
	Date       string `json:"date"`
	Orders     int    `json:"orders"`
	RevenueBDT string `json:"revenue_bdt"`
}

// TopProductDTO is a single row in the top products response.
type TopProductDTO struct {
	ProductID       string `json:"product_id"`
	ProductName     string `json:"product_name"`
	TotalQuantity   int    `json:"total_quantity"`
	TotalRevenueBDT string `json:"total_revenue_bdt"`
}

// PopularProductDTO is the public version — no revenue data.
type PopularProductDTO struct {
	ProductID     string `json:"product_id"`
	ProductName   string `json:"product_name"`
	TotalQuantity int    `json:"total_quantity"`
}

// PeriodSummaryDTO is the aggregate metrics for a single date window.
type PeriodSummaryDTO struct {
	StartDate    string  `json:"start_date"`
	EndDate      string  `json:"end_date"`
	RevenueBDT   string  `json:"revenue_bdt"`
	Orders       int     `json:"orders"`
	AOVBDT       string  `json:"aov_bdt"`
	TotalVisits  int     `json:"total_visits"`
	UniqueVisits int     `json:"unique_visits"`
	OrderRate    float64 `json:"order_rate"`
}

// SummaryChangesDTO holds percentage changes between two periods. Null fields
// signal "previous value was zero so percentage is undefined".
type SummaryChangesDTO struct {
	RevenuePct      *float64 `json:"revenue_pct"`
	OrdersPct       *float64 `json:"orders_pct"`
	AOVPct          *float64 `json:"aov_pct"`
	TotalVisitsPct  *float64 `json:"total_visits_pct"`
	UniqueVisitsPct *float64 `json:"unique_visits_pct"`
	OrderRatePct    *float64 `json:"order_rate_pct"`
}

// StatsSummaryDTO is the response for GET /api/shops/me/stats/summary.
type StatsSummaryDTO struct {
	Current  PeriodSummaryDTO   `json:"current"`
	Previous *PeriodSummaryDTO  `json:"previous,omitempty"`
	Changes  *SummaryChangesDTO `json:"changes,omitempty"`
}

// LowStockProductDTO is one row in the dashboard's reorder list.
type LowStockProductDTO struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Stock    int    `json:"stock"`
	PriceBDT string `json:"price_bdt"`
}

// DashboardSummaryDTO is the seller home page response.
type DashboardSummaryDTO struct {
	PendingOrdersCount     int                  `json:"pending_orders_count"`
	AwaitingAdvanceCount   int                  `json:"awaiting_advance_count"`
	UnansweredReviewsCount int                  `json:"unanswered_reviews_count"`
	OutOfStockCount        int                  `json:"out_of_stock_count"`
	LowStockCount          int                  `json:"low_stock_count"`

	TodayRevenueBDT     string `json:"today_revenue_bdt"`
	TodayOrders         int    `json:"today_orders"`
	InTransitOrders     int    `json:"in_transit_orders"`
	InTransitAmountBDT  string `json:"in_transit_amount_bdt"`
	DeliveredWeekOrders int    `json:"delivered_week_orders"`
	DeliveredWeekBDT    string `json:"delivered_week_bdt"`

	LowStockProducts []LowStockProductDTO `json:"low_stock_products"`
}
