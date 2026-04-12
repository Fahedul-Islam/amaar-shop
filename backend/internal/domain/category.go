package domain

import (
	"errors"
	"time"
)

// Category is a seller-defined grouping for products within a single shop.
// Uniqueness is enforced per shop (case-insensitive on name).
type Category struct {
	ID        string    `json:"id"`
	ShopID    string    `json:"shop_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	ErrCategoryNotFound  = errors.New("category not found")
	ErrCategoryNotInShop = errors.New("category does not belong to this shop")
	ErrCategoryNameTaken = errors.New("a category with this name already exists")
)
