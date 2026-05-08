// Package paymentmethod contains HTTP handlers for seller-configured
// advance-fee payment methods (bank / mobile banking).
package paymentmethod

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

// Service is the interface the handler depends on.
type Service interface {
	ListMine(ctx context.Context, ownerUserID string) ([]*domain.ShopPaymentMethod, error)
	ListPublicBySlug(ctx context.Context, slug string) ([]*domain.ShopPaymentMethod, error)
	Create(ctx context.Context, ownerUserID string, m *domain.ShopPaymentMethod) (*domain.ShopPaymentMethod, error)
	Update(ctx context.Context, ownerUserID, methodID string, m *domain.ShopPaymentMethod) (*domain.ShopPaymentMethod, error)
	Delete(ctx context.Context, ownerUserID, methodID string) error
}

// Handler exposes /api/shops/me/payment-methods and the public list endpoint.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func toDTO(m *domain.ShopPaymentMethod) dto.PaymentMethodDTO {
	return dto.PaymentMethodDTO{
		ID:            m.ID,
		ShopID:        m.ShopID,
		MethodType:    m.MethodType,
		DisplayOrder:  m.DisplayOrder,
		IsActive:      m.IsActive,
		BankName:      m.BankName,
		AccountNumber: m.AccountNumber,
		AccountName:   m.AccountName,
		Branch:        m.Branch,
		RoutingNumber: m.RoutingNumber,
		MBProvider:    m.MBProvider,
		MBPhone:       m.MBPhone,
		MBNumberType:  m.MBNumberType,
		CreatedAt:     m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     m.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// toPublicDTO redacts internal fields from public responses.
func toPublicDTO(m *domain.ShopPaymentMethod) dto.PaymentMethodDTO {
	d := toDTO(m)
	d.ShopID = ""
	d.CreatedAt = ""
	d.UpdatedAt = ""
	return d
}

func fromRequest(req *dto.PaymentMethodRequest) *domain.ShopPaymentMethod {
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	return &domain.ShopPaymentMethod{
		MethodType:    req.MethodType,
		DisplayOrder:  req.DisplayOrder,
		IsActive:      active,
		BankName:      req.BankName,
		AccountNumber: req.AccountNumber,
		AccountName:   req.AccountName,
		Branch:        req.Branch,
		RoutingNumber: req.RoutingNumber,
		MBProvider:    req.MBProvider,
		MBPhone:       req.MBPhone,
		MBNumberType:  req.MBNumberType,
	}
}
