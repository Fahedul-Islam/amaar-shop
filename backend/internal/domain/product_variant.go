package domain

import "time"

// ProductVariant exists in the schema from day one so later sub-prompts can
// expose size/color options without a migration. MVP UI does not surface it.
type ProductVariant struct {
	ID            string    `json:"id"`
	ProductID     string    `json:"product_id"`
	Name          string    `json:"name"`
	SKU           string    `json:"sku"`
	PriceOverride *string   `json:"price_override"`
	Stock         int       `json:"stock"`
	CreatedAt     time.Time `json:"created_at"`
}
