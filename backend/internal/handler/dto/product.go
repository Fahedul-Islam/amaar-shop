package dto

import "time"

// --- Category ---

type CreateCategoryRequest struct {
	Name string `json:"name"`
}

type UpdateCategoryRequest struct {
	Name string `json:"name"`
}

type CategoryDTO struct {
	ID        string    `json:"id"`
	ShopID    string    `json:"shop_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type PublicCategoryDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// --- Product ---

// CreateProductRequest is the JSON body for POST /api/shops/me/products.
type CreateProductRequest struct {
	Name                  string  `json:"name"`
	Description           string  `json:"description"`
	PriceBDT              string  `json:"price_bdt"`
	Stock                 int     `json:"stock"`
	CategoryID            *string `json:"category_id"`
	IsActive              *bool   `json:"is_active"`
	DiscountType          *string `json:"discount_type"`
	DiscountValue         *string `json:"discount_value"`
	DeliveryChargeDhaka   *string `json:"delivery_charge_dhaka"`
	DeliveryChargeOutside *string `json:"delivery_charge_outside"`
}

// UpdateProductRequest mirrors CreateProductRequest but every field is optional.
// A null CategoryID clears the category; omitting the field leaves it unchanged.
type UpdateProductRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	PriceBDT    *string `json:"price_bdt"`
	Stock       *int    `json:"stock"`
	// CategoryID uses a custom hasCategoryID marker in the handler because
	// encoding/json cannot distinguish null from omitted for pointer fields.
	CategoryID *string `json:"category_id"`
	IsActive   *bool   `json:"is_active"`
}

type ReorderImagesRequest struct {
	ImageIDs []string `json:"image_ids"`
}

type ProductImageDTO struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id,omitempty"`
	URL       string    `json:"url"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type ProductDTO struct {
	ID                    string            `json:"id"`
	ShopID                string            `json:"shop_id"`
	CategoryID            *string           `json:"category_id"`
	Name                  string            `json:"name"`
	Description           string            `json:"description"`
	PriceBDT              string            `json:"price_bdt"`
	Stock                 int               `json:"stock"`
	IsActive              bool              `json:"is_active"`
	IsArchived            bool              `json:"is_archived"`
	DiscountType          *string           `json:"discount_type"`
	DiscountValue         *string           `json:"discount_value"`
	DeliveryChargeDhaka   *string           `json:"delivery_charge_dhaka"`
	DeliveryChargeOutside *string           `json:"delivery_charge_outside"`
	Images                []ProductImageDTO `json:"images"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
}

type PublicProductDTO struct {
	ID                    string            `json:"id"`
	Name                  string            `json:"name"`
	Description           string            `json:"description"`
	PriceBDT              string            `json:"price_bdt"`
	Stock                 int               `json:"stock"`
	CategoryID            *string           `json:"category_id"`
	DiscountType          *string           `json:"discount_type"`
	DiscountValue         *string           `json:"discount_value"`
	DeliveryChargeDhaka   *string           `json:"delivery_charge_dhaka"`
	DeliveryChargeOutside *string           `json:"delivery_charge_outside"`
	Images                []ProductImageDTO `json:"images"`
}

// ArchiveResponse is the trimmed shape for POST /products/{id}/archive.
type ArchiveResponse struct {
	ID         string `json:"id"`
	IsArchived bool   `json:"is_archived"`
}

// --- Pagination ---

type PaginationDTO struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}
