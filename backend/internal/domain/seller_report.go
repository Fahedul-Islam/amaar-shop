package domain

import "time"

// OrderReport bundles all data needed for the seller's order analytics PDF
// over a given date range.
type OrderReport struct {
	From time.Time
	To   time.Time

	TotalOrders     int
	TotalRevenueBDT string // excludes cancelled
	GrossSalesBDT   string // includes everything
	AOVBDT          string // average order value, excluding cancelled

	// Counts by status — keys are the order status enum values.
	StatusCounts map[string]int
	// Revenue by status (sum of total_bdt grouped by status).
	StatusRevenueBDT map[string]string

	// Daily breakdown — useful to spot peak days.
	Daily []DayStat
	// Day with highest revenue (excluding cancelled). Empty when no data.
	PeakDay DayStat

	// Top 10 products purchased in the window, by quantity.
	TopProducts []TopProduct

	// Customer trends.
	UniqueCustomers   int
	RepeatCustomers   int // customers with > 1 order in window
	TopCustomers      []TopCustomer
	NewCustomerOrders int // first-ever order from a phone (over all time) that landed in window
}

// TopCustomer is one row of the customer purchasing trend table.
type TopCustomer struct {
	CustomerName  string
	CustomerPhone string
	Orders        int
	TotalBDT      string
}

// ProductReport bundles all data needed for the seller's product/inventory
// analytics PDF.
type ProductReport struct {
	From time.Time
	To   time.Time

	// Catalog snapshot (current state — inventory is point-in-time).
	TotalActiveProducts int
	TotalArchived       int
	OutOfStockCount     int
	LowStockCount       int
	TotalStockUnits     int

	// Catalog churn within the date range.
	ProductsAddedInRange int

	// Per-product performance (sold qty + revenue in window, plus current stock).
	Rows []ProductReportRow

	// Per-category breakdown (rolled up from Rows).
	Categories []CategoryReportRow

	// Best & worst from Rows.
	TopSellers []ProductReportRow // up to 10, by quantity sold in range
	NoMovement []ProductReportRow // active products with 0 sales in range

	// Inventory alerts (current state).
	OutOfStock []LowStockProduct // sorted by potential lost revenue desc
	LowStock   []LowStockProduct // 1..lowStockThreshold

	// Inventory turnover (units sold in range / current stock units).
	// Stored as a percentage with two decimals.
	TurnoverPct float64
}

// ProductReportRow is one row of the per-product breakdown.
type ProductReportRow struct {
	ProductID    string
	ProductName  string
	CategoryName string // "" if uncategorized
	PriceBDT     string
	CurrentStock int
	UnitsSold    int    // within the report window
	RevenueBDT   string // within the report window
	IsActive     bool
	IsArchived   bool
	CreatedAt    time.Time
}

// CategoryReportRow rolls up per-product numbers by category.
type CategoryReportRow struct {
	CategoryName string // "Uncategorized" for nulls
	Products     int
	UnitsSold    int
	RevenueBDT   string
}
