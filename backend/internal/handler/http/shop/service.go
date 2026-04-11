// Package shop contains HTTP handlers for shop and delivery-settings endpoints.
package shop

import (
	"context"
	"io"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the shop handler depends on.
// Defined at the consumer so the handler is decoupled from the service package.
type Service interface {
	CreateShop(ctx context.Context, ownerUserID, name, slug, description, contactPhone string) (*domain.Shop, error)
	GetMyShop(ctx context.Context, ownerUserID string) (*domain.Shop, error)
	UpdateShop(ctx context.Context, ownerUserID, name, description, contactPhone string) (*domain.Shop, error)
	UploadLogo(ctx context.Context, ownerUserID string, file io.Reader, filename string) (string, error)
	UploadBanner(ctx context.Context, ownerUserID string, file io.Reader, filename string) (string, error)
	CheckSlug(ctx context.Context, slug string) (bool, error)
	GetDeliverySettings(ctx context.Context, ownerUserID string) (*domain.DeliverySettings, error)
	UpdateDeliverySettings(ctx context.Context, ownerUserID string, settings *domain.DeliverySettings) (*domain.DeliverySettings, error)
	GetPublicShop(ctx context.Context, slug string) (*domain.Shop, error)
	GetPublicDeliverySettings(ctx context.Context, slug string) (*domain.DeliverySettings, error)
}
