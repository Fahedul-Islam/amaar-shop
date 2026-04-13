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
