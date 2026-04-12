// Package product contains HTTP handlers for product management endpoints.
package product

import (
	"context"
	"io"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the product handler depends on.
// Defined at the consumer so the handler package doesn't import the service package.
// The concrete *service.ProductService satisfies it.
type Service interface {
	CreateProduct(ctx context.Context, ownerUserID string, in service.CreateProductInput) (*domain.Product, error)
	UpdateProduct(ctx context.Context, ownerUserID, productID string, in service.UpdateProductInput) (*domain.Product, error)
	ArchiveProduct(ctx context.Context, ownerUserID, productID string) (*domain.Product, error)
	DeleteProduct(ctx context.Context, ownerUserID, productID string) error
	GetProduct(ctx context.Context, ownerUserID, productID string) (*domain.Product, error)
	ListProducts(ctx context.Context, ownerUserID string, filter domain.ProductFilter) ([]*domain.Product, int, error)
	ListPublicProducts(ctx context.Context, slug string, filter domain.ProductFilter) ([]*domain.Product, int, error)
	GetPublicProduct(ctx context.Context, slug, productID string) (*domain.Product, error)

	UploadImage(ctx context.Context, ownerUserID, productID string, file io.Reader, filename string) (*domain.ProductImage, error)
	DeleteImage(ctx context.Context, ownerUserID, productID, imageID string) error
	ReorderImages(ctx context.Context, ownerUserID, productID string, imageIDs []string) ([]*domain.ProductImage, error)
}
