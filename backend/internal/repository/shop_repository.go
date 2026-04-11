package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ShopRepository defines persistence operations for shops.
type ShopRepository interface {
	// Create inserts a new shop and populates generated fields (id, timestamps).
	Create(ctx context.Context, shop *domain.Shop) error

	// FindByID returns a shop by its UUID.
	FindByID(ctx context.Context, id string) (*domain.Shop, error)

	// FindBySlug returns a shop by its unique slug.
	FindBySlug(ctx context.Context, slug string) (*domain.Shop, error)

	// FindByOwnerID returns the shop owned by the given user.
	FindByOwnerID(ctx context.Context, ownerUserID string) (*domain.Shop, error)

	// Update persists changes to a shop's mutable fields (name, description, contact_phone, logo_url, banner_url).
	Update(ctx context.Context, shop *domain.Shop) error

	// IsSlugAvailable returns true if no shop uses the given slug.
	IsSlugAvailable(ctx context.Context, slug string) (bool, error)
}
