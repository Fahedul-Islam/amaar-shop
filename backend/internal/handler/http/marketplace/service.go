package marketplace

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the marketplace handler depends on.
type Service interface {
	ListProducts(ctx context.Context, filter domain.MarketplaceProductFilter) ([]*domain.MarketplaceProduct, int, error)
	ListShops(ctx context.Context, query string, limit, offset int) ([]*domain.Shop, int, error)
	ListCategories(ctx context.Context) ([]string, error)
	LookupOrdersByPhone(ctx context.Context, phone string) ([]*domain.Order, error)
}
