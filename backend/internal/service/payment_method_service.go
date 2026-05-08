package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// PaymentMethodService manages a shop's advance-fee payment methods. All
// authenticated operations are keyed off the owner's user ID and look up
// the shop ID once internally.
type PaymentMethodService struct {
	shops    repository.ShopRepository
	delivery repository.DeliverySettingsRepository
	methods  repository.PaymentMethodRepository
}

func NewPaymentMethodService(
	shops repository.ShopRepository,
	delivery repository.DeliverySettingsRepository,
	methods repository.PaymentMethodRepository,
) *PaymentMethodService {
	return &PaymentMethodService{shops: shops, delivery: delivery, methods: methods}
}

// ListMine returns all payment methods for the authenticated owner's shop.
func (s *PaymentMethodService) ListMine(ctx context.Context, ownerUserID string) ([]*domain.ShopPaymentMethod, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.methods.List(ctx, shop.ID)
}

// ListPublicBySlug returns active payment methods for a shop, used at checkout.
func (s *PaymentMethodService) ListPublicBySlug(ctx context.Context, slug string) ([]*domain.ShopPaymentMethod, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}
	return s.methods.ListPublic(ctx, shop.ID)
}

// Create validates and inserts a new payment method for the owner's shop.
func (s *PaymentMethodService) Create(ctx context.Context, ownerUserID string, m *domain.ShopPaymentMethod) (*domain.ShopPaymentMethod, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	m.ShopID = shop.ID
	if err := m.Validate(); err != nil {
		return nil, err
	}
	if err := s.methods.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Update overwrites a payment method, enforcing shop ownership.
func (s *PaymentMethodService) Update(ctx context.Context, ownerUserID, methodID string, m *domain.ShopPaymentMethod) (*domain.ShopPaymentMethod, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	existing, err := s.methods.Get(ctx, methodID)
	if err != nil {
		return nil, err
	}
	if existing.ShopID != shop.ID {
		return nil, domain.ErrPaymentMethodNotFound
	}
	m.ID = methodID
	m.ShopID = shop.ID
	if err := m.Validate(); err != nil {
		return nil, err
	}
	if err := s.methods.Update(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Delete removes a payment method owned by the caller's shop.
func (s *PaymentMethodService) Delete(ctx context.Context, ownerUserID, methodID string) error {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return err
	}
	return s.methods.Delete(ctx, shop.ID, methodID)
}
