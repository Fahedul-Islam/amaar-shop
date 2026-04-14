package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// MarketplaceRepository defines read-only queries for the public marketplace homepage.
// These queries span all shops (no shop_id scoping).
type MarketplaceRepository interface {
	// ListProducts returns active, non-archived products across all non-suspended shops.
	// Supports text search, category name filtering, and pagination.
	ListProducts(ctx context.Context, filter domain.MarketplaceProductFilter) ([]*domain.MarketplaceProduct, int, error)

	// ListShops returns non-suspended shops, optionally filtered by name search.
	ListShops(ctx context.Context, query string, limit, offset int) ([]*domain.Shop, int, error)

	// ListCategories returns distinct category names across all non-suspended shops.
	ListCategories(ctx context.Context) ([]string, error)

	// LookupOrdersByPhone returns all orders matching the given phone number across all shops.
	LookupOrdersByPhone(ctx context.Context, phone string) ([]*domain.Order, error)
}
