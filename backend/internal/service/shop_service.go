package service

import (
	"context"
	"io"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// ShopService handles shop CRUD, delivery settings, and image uploads.
type ShopService struct {
	shops    repository.ShopRepository
	delivery repository.DeliverySettingsRepository
	reviews  repository.ReviewRepository
	files    storage.FileStorage
}

func NewShopService(
	shops repository.ShopRepository,
	delivery repository.DeliverySettingsRepository,
	reviews repository.ReviewRepository,
	files storage.FileStorage,
) *ShopService {
	return &ShopService{shops: shops, delivery: delivery, reviews: reviews, files: files}
}

// CreateShop creates a new shop for the authenticated user and seeds default delivery settings.
func (s *ShopService) CreateShop(ctx context.Context, ownerUserID, name, slug, description, contactPhone string) (*domain.Shop, error) {
	if !domain.ValidSlug(slug) {
		return nil, domain.ErrSlugTaken // validation happens at handler level; this is a safety check
	}

	shop := &domain.Shop{
		OwnerUserID:  ownerUserID,
		Slug:         slug,
		Name:         name,
		Description:  description,
		ContactPhone: contactPhone,
	}

	if err := s.shops.Create(ctx, shop); err != nil {
		return nil, err
	}

	// Seed default delivery settings row.
	defaults := &domain.DeliverySettings{
		ShopID:         shop.ID,
		CODEnabled:     true,
		DeliveryCharge: "0.00",
		DeliveryAreas:  []string{},
	}
	if err := s.delivery.Upsert(ctx, defaults); err != nil {
		return nil, err
	}

	return shop, nil
}

// GetMyShop returns the shop owned by the given user.
func (s *ShopService) GetMyShop(ctx context.Context, ownerUserID string) (*domain.Shop, error) {
	return s.shops.FindByOwnerID(ctx, ownerUserID)
}

// UpdateShop updates mutable branding fields. Only the owner may call this.
func (s *ShopService) UpdateShop(ctx context.Context, ownerUserID, name, description, contactPhone string) (*domain.Shop, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	if name != "" {
		shop.Name = name
	}
	if description != "" {
		shop.Description = description
	}
	// Allow clearing contact_phone by sending empty string — but only update if explicitly provided.
	// The handler will decide what to pass based on JSON presence.
	shop.ContactPhone = contactPhone

	if err := s.shops.Update(ctx, shop); err != nil {
		return nil, err
	}
	return shop, nil
}

// UploadLogo saves a logo image and updates the shop's logo_url.
func (s *ShopService) UploadLogo(ctx context.Context, ownerUserID string, file io.Reader, filename string) (string, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return "", err
	}

	url, err := s.files.Save(file, "logo", filename)
	if err != nil {
		return "", err
	}

	shop.LogoURL = url
	if err := s.shops.Update(ctx, shop); err != nil {
		return "", err
	}
	return url, nil
}

// UploadBanner saves a banner image and updates the shop's banner_url.
func (s *ShopService) UploadBanner(ctx context.Context, ownerUserID string, file io.Reader, filename string) (string, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return "", err
	}

	url, err := s.files.Save(file, "banner", filename)
	if err != nil {
		return "", err
	}

	shop.BannerURL = url
	if err := s.shops.Update(ctx, shop); err != nil {
		return "", err
	}
	return url, nil
}

// CheckSlug returns true if the slug is available.
func (s *ShopService) CheckSlug(ctx context.Context, slug string) (bool, error) {
	return s.shops.IsSlugAvailable(ctx, slug)
}

// GetDeliverySettings returns the delivery settings for the authenticated user's shop.
func (s *ShopService) GetDeliverySettings(ctx context.Context, ownerUserID string) (*domain.DeliverySettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.delivery.Get(ctx, shop.ID)
}

// UpdateDeliverySettings validates and persists delivery settings.
func (s *ShopService) UpdateDeliverySettings(ctx context.Context, ownerUserID string, settings *domain.DeliverySettings) (*domain.DeliverySettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}

	// Validate charge >= 0
	charge, err := strconv.ParseFloat(settings.DeliveryCharge, 64)
	if err != nil || charge < 0 {
		return nil, domain.ErrInvalidDeliveryCharge
	}

	// Validate threshold > charge when set
	if settings.FreeDeliveryThreshold != nil && *settings.FreeDeliveryThreshold != "" {
		threshold, err := strconv.ParseFloat(*settings.FreeDeliveryThreshold, 64)
		if err != nil || threshold <= charge {
			return nil, domain.ErrInvalidThreshold
		}
	}

	// Validate delivery areas non-empty when COD enabled
	if settings.CODEnabled && len(settings.DeliveryAreas) == 0 {
		return nil, domain.ErrDeliveryAreasRequired
	}

	settings.ShopID = shop.ID
	if err := s.delivery.Upsert(ctx, settings); err != nil {
		return nil, err
	}
	return settings, nil
}

// GetPublicShop returns the shop by slug, returning ErrShopNotFound if suspended.
// The returned shop is enriched with the aggregate review rating.
func (s *ShopService) GetPublicShop(ctx context.Context, slug string) (*domain.Shop, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}
	if rating, err := s.reviews.ShopRating(ctx, shop.ID); err == nil {
		shop.RatingAverage = rating.Average
		shop.RatingCount = rating.Count
	}
	return shop, nil
}

// GetPublicDeliverySettings returns delivery settings for a public shop by slug.
func (s *ShopService) GetPublicDeliverySettings(ctx context.Context, slug string) (*domain.DeliverySettings, error) {
	shop, err := s.GetPublicShop(ctx, slug)
	if err != nil {
		return nil, err
	}
	return s.delivery.Get(ctx, shop.ID)
}
