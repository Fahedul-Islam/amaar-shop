// Package category contains HTTP handlers for category endpoints.
package category

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the category handler depends on.
// Defined at the consumer so the handler doesn't import the service package.
type Service interface {
	CreateCategory(ctx context.Context, ownerUserID, name string) (*domain.Category, error)
	UpdateCategory(ctx context.Context, ownerUserID, id, name string) (*domain.Category, error)
	DeleteCategory(ctx context.Context, ownerUserID, id string) error
	ListCategories(ctx context.Context, ownerUserID string) ([]*domain.Category, error)
	ListPublicCategories(ctx context.Context, slug string) ([]*domain.Category, error)
}
