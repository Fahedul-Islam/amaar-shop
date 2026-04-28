package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// MarketplaceService handles the public marketplace homepage logic.
type MarketplaceService struct {
	marketplace repository.MarketplaceRepository
	orders      repository.OrderRepository
}

func NewMarketplaceService(
	marketplace repository.MarketplaceRepository,
	orders repository.OrderRepository,
) *MarketplaceService {
	return &MarketplaceService{marketplace: marketplace, orders: orders}
}

func (s *MarketplaceService) ListProducts(ctx context.Context, filter domain.MarketplaceProductFilter) ([]*domain.MarketplaceProduct, int, error) {
	return s.marketplace.ListProducts(ctx, filter)
}

func (s *MarketplaceService) ListShops(ctx context.Context, query string, page, size int) ([]*domain.Shop, int, error) {
	offset := 0
	if page > 1 {
		offset = (page - 1) * size
	}
	return s.marketplace.ListShops(ctx, query, size, offset)
}

func (s *MarketplaceService) ListCategories(ctx context.Context) ([]string, error) {
	return s.marketplace.ListCategories(ctx)
}

func (s *MarketplaceService) LookupOrdersByPhone(ctx context.Context, phone string) ([]*domain.Order, error) {
	phone = normalizePhone(phone)
	orders, err := s.marketplace.LookupOrdersByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if len(orders) > 0 {
		if err := s.orders.LoadItems(ctx, orders...); err != nil {
			return nil, err
		}
	}
	return orders, nil
}
