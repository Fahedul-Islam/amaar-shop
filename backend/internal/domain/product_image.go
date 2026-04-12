package domain

import "time"

// ProductImage is a single image attached to a product. Ordering in galleries
// is driven by SortOrder ascending.
type ProductImage struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	URL       string    `json:"url"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}
