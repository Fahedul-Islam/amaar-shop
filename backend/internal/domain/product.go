package domain

import (
	"errors"
	"time"
)

// MaxProductImages is the per-product image limit enforced by the service layer.
const MaxProductImages = 5

// Product is a sellable item in a shop's catalog. Images are loaded alongside
// the product by the repository so handlers don't need a second round-trip.
type Product struct {
	ID          string         `json:"id"`
	ShopID      string         `json:"shop_id"`
	CategoryID  *string        `json:"category_id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	PriceBDT    string         `json:"price_bdt"`
	Stock       int            `json:"stock"`
	IsActive    bool           `json:"is_active"`
	IsArchived  bool           `json:"is_archived"`
	Images      []ProductImage `json:"images"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// ProductFilter captures the optional filters and pagination that seller and
// public listing endpoints accept. The repository applies them as SQL predicates.
// Public callers force IsArchived=false and IsActive=true at the service layer.
type ProductFilter struct {
	Query      string
	CategoryID *string
	IsActive   *bool
	IsArchived *bool
	Page       int
	PageSize   int
}

// Offset returns the SQL OFFSET value for the filter's current page.
func (f ProductFilter) Offset() int {
	if f.Page <= 0 {
		return 0
	}
	return (f.Page - 1) * f.PageSize
}

var (
	ErrProductNotFound   = errors.New("product not found")
	ErrInsufficientStock = errors.New("insufficient stock")
	ErrTooManyImages     = errors.New("product already has the maximum number of images")
	ErrInvalidPrice      = errors.New("price must be greater than 0")
	ErrInvalidStock      = errors.New("stock must be greater than or equal to 0")
	ErrProductNameRequired = errors.New("product name is required")
)
