package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// CategoryService enforces ownership and shop-resolution rules on category
// operations. It depends only on repository interfaces.
type CategoryService struct {
	shops      repository.ShopRepository
	categories repository.CategoryRepository
}

func NewCategoryService(shops repository.ShopRepository, categories repository.CategoryRepository) *CategoryService {
	return &CategoryService{shops: shops, categories: categories}
}

// resolveShop returns the caller's shop or the corresponding domain error.
func (s *CategoryService) resolveShop(ctx context.Context, ownerUserID string) (*domain.Shop, error) {
	return s.shops.FindByOwnerID(ctx, ownerUserID)
}

// resolvePublicShop returns the shop by slug, treating suspended shops as not found.
func (s *CategoryService) resolvePublicShop(ctx context.Context, slug string) (*domain.Shop, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}
	return shop, nil
}

func (s *CategoryService) CreateCategory(ctx context.Context, ownerUserID, name string) (*domain.Category, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	c := &domain.Category{ShopID: shop.ID, Name: name}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CategoryService) UpdateCategory(ctx context.Context, ownerUserID, id, name string) (*domain.Category, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	c := &domain.Category{ID: id, ShopID: shop.ID, Name: name}
	if err := s.categories.Update(ctx, c); err != nil {
		return nil, err
	}
	// Re-read so CreatedAt is populated for the response.
	return s.categories.FindByID(ctx, id, shop.ID)
}

func (s *CategoryService) DeleteCategory(ctx context.Context, ownerUserID, id string) error {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return err
	}
	return s.categories.Delete(ctx, id, shop.ID)
}

func (s *CategoryService) ListCategories(ctx context.Context, ownerUserID string) ([]*domain.Category, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.categories.ListByShop(ctx, shop.ID)
}

func (s *CategoryService) ListPublicCategories(ctx context.Context, slug string) ([]*domain.Category, error) {
	shop, err := s.resolvePublicShop(ctx, slug)
	if err != nil {
		return nil, err
	}
	return s.categories.ListByShop(ctx, shop.ID)
}
