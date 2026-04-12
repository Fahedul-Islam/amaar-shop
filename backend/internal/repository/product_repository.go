package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ProductRepository defines persistence operations for products and their images.
// All operations are shop-scoped: id lookups, updates, and deletes include shop_id
// in the predicate so an ID leaked from one shop cannot be used against another.
type ProductRepository interface {
	Create(ctx context.Context, p *domain.Product) error
	Update(ctx context.Context, p *domain.Product) error
	Archive(ctx context.Context, id, shopID string) error
	Delete(ctx context.Context, id, shopID string) error
	FindByID(ctx context.Context, id, shopID string) (*domain.Product, error)
	ListByShop(ctx context.Context, shopID string, filter domain.ProductFilter) ([]*domain.Product, int, error)
	// ListPublicByShopSlug resolves the shop by slug (404 if suspended or missing)
	// and returns only active, non-archived products. Public storefront entry point.
	ListPublicByShopSlug(ctx context.Context, slug string, filter domain.ProductFilter) ([]*domain.Product, int, error)

	// Image operations.
	AddImage(ctx context.Context, img *domain.ProductImage, shopID string) error
	DeleteImage(ctx context.Context, imageID, productID, shopID string) error
	ListImages(ctx context.Context, productID, shopID string) ([]*domain.ProductImage, error)
	CountImages(ctx context.Context, productID, shopID string) (int, error)
	ReorderImages(ctx context.Context, productID, shopID string, imageIDs []string) error
}
