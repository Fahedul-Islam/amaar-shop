package domain

import "time"

// ProductVisit is a single page-load event for a public product page.
// Rows in product_visits are append-only; they're rolled up nightly into
// ProductVisitSummary by the analytics aggregation cron.
type ProductVisit struct {
	ID        string    `json:"id"`
	ShopID    string    `json:"shop_id"`
	ProductID string    `json:"product_id"`
	VisitorID string    `json:"visitor_id"`
	Referrer  string    `json:"referrer"`
	UserAgent string    `json:"user_agent"`
	VisitedAt time.Time `json:"visited_at"`
}

// VisitBucketStats is one row of the daily/weekly/monthly time series the seller dashboard renders.
type VisitBucketStats struct {
	Bucket       string `json:"bucket"`
	TotalVisits  int    `json:"total_visits"`
	UniqueVisits int    `json:"unique_visits"`
}

// TopVisitedProduct is one row in the "most-visited products" panel.
type TopVisitedProduct struct {
	ProductID    string `json:"product_id"`
	ProductName  string `json:"product_name"`
	TotalVisits  int    `json:"total_visits"`
	UniqueVisits int    `json:"unique_visits"`
}

// VisitConversion compares product page visits against placed orders.
// OrderRate is orders / unique visits, expressed as a percentage rounded to 2dp.
type VisitConversion struct {
	UniqueVisits int     `json:"unique_visits"`
	TotalVisits  int     `json:"total_visits"`
	OrderCount   int     `json:"order_count"`
	OrderRate    float64 `json:"order_rate"`
}

// VisitPeriod selects the bucket size for time-series visit queries.
type VisitPeriod string

const (
	VisitPeriodDaily   VisitPeriod = "daily"
	VisitPeriodWeekly  VisitPeriod = "weekly"
	VisitPeriodMonthly VisitPeriod = "monthly"
)

// IsValid reports whether p is one of the supported periods.
func (p VisitPeriod) IsValid() bool {
	switch p {
	case VisitPeriodDaily, VisitPeriodWeekly, VisitPeriodMonthly:
		return true
	}
	return false
}
