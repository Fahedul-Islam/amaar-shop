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
