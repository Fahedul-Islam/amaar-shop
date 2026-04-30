package dto

// TrackVisitRequest is the body for POST /api/track/product-view.
// shop_slug is required so the server can resolve the owning shop without
// trusting the client to supply a shop_id directly.
type TrackVisitRequest struct {
	ShopSlug  string `json:"shop_slug"`
	ProductID string `json:"product_id"`
}

// VisitBucketDTO is one row of the visit time series.
type VisitBucketDTO struct {
	Bucket       string `json:"bucket"`
	TotalVisits  int    `json:"total_visits"`
	UniqueVisits int    `json:"unique_visits"`
}

// TopVisitedProductDTO is one row of the top-visited products list.
type TopVisitedProductDTO struct {
	ProductID    string `json:"product_id"`
	ProductName  string `json:"product_name"`
	TotalVisits  int    `json:"total_visits"`
	UniqueVisits int    `json:"unique_visits"`
}

// VisitConversionDTO summarises visits vs orders for the dashboard's funnel widget.
type VisitConversionDTO struct {
	UniqueVisits int     `json:"unique_visits"`
	TotalVisits  int     `json:"total_visits"`
	OrderCount   int     `json:"order_count"`
	OrderRate    float64 `json:"order_rate"`
}

// VisitSummaryDTO is the wrapped response for /api/shops/me/visits/summary.
type VisitSummaryDTO struct {
	Period  string           `json:"period"`
	From    string           `json:"from"`
	To      string           `json:"to"`
	Buckets []VisitBucketDTO `json:"buckets"`
}
