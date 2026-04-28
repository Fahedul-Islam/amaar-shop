package shop

import (
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

// Handler implements the /api/shops/* endpoints defined in docs/API.md.
type Handler struct {
	svc       Service
	cfg   *config.Config
}

// NewHandler constructs a Handler from any type satisfying the Service interface.
func NewHandler(svc Service, config *config.Config) *Handler {
	return &Handler{svc: svc, cfg: config}
}

// --- DTO converters ---

func toShopDTO(s *domain.Shop) dto.ShopDTO {
	d := dto.ShopDTO{
		ID:           s.ID,
		OwnerUserID:  s.OwnerUserID,
		Slug:         s.Slug,
		Name:         s.Name,
		Description:  s.Description,
		ContactPhone: s.ContactPhone,
		IsSuspended:  s.IsSuspended,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}
	if s.LogoURL != "" {
		d.LogoURL = &s.LogoURL
	}
	if s.BannerURL != "" {
		d.BannerURL = &s.BannerURL
	}
	return d
}

func toPublicShopDTO(s *domain.Shop) dto.PublicShopDTO {
	d := dto.PublicShopDTO{
		ID:            s.ID,
		Slug:          s.Slug,
		Name:          s.Name,
		Description:   s.Description,
		ContactPhone:  s.ContactPhone,
		RatingAverage: s.RatingAverage,
		RatingCount:   s.RatingCount,
	}
	if s.LogoURL != "" {
		d.LogoURL = &s.LogoURL
	}
	if s.BannerURL != "" {
		d.BannerURL = &s.BannerURL
	}
	return d
}

func toDeliverySettingsDTO(ds *domain.DeliverySettings) dto.DeliverySettingsDTO {
	return dto.DeliverySettingsDTO{
		ShopID:                     ds.ShopID,
		CODEnabled:                 ds.CODEnabled,
		DeliveryCharge:             ds.DeliveryCharge,
		FreeDeliveryThreshold:      ds.FreeDeliveryThreshold,
		AdvancePaymentRequired:     ds.AdvancePaymentRequired,
		AdvancePaymentInstructions: ds.AdvancePaymentInstructions,
		DeliveryAreas:              ds.DeliveryAreas,
		UpdatedAt:                  ds.UpdatedAt,
	}
}

func toPublicDeliverySettingsDTO(ds *domain.DeliverySettings) dto.PublicDeliverySettingsDTO {
	return dto.PublicDeliverySettingsDTO{
		CODEnabled:                 ds.CODEnabled,
		DeliveryCharge:             ds.DeliveryCharge,
		FreeDeliveryThreshold:      ds.FreeDeliveryThreshold,
		AdvancePaymentRequired:     ds.AdvancePaymentRequired,
		AdvancePaymentInstructions: ds.AdvancePaymentInstructions,
		DeliveryAreas:              ds.DeliveryAreas,
	}
}
