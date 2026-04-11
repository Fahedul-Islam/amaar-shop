package dto

import "time"

// --- Requests ---

// CreateShopRequest is the JSON body for POST /api/shops.
type CreateShopRequest struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Description  string `json:"description"`
	ContactPhone string `json:"contact_phone"`
}

// UpdateShopRequest is the JSON body for PATCH /api/shops/me.
type UpdateShopRequest struct {
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	ContactPhone *string `json:"contact_phone"`
}

// UpdateDeliverySettingsRequest is the JSON body for PUT /api/shops/me/delivery-settings.
type UpdateDeliverySettingsRequest struct {
	CODEnabled                 bool     `json:"cod_enabled"`
	DeliveryCharge             string   `json:"delivery_charge"`
	FreeDeliveryThreshold      *string  `json:"free_delivery_threshold"`
	AdvancePaymentRequired     bool     `json:"advance_payment_required"`
	AdvancePaymentInstructions string   `json:"advance_payment_instructions"`
	DeliveryAreas              []string `json:"delivery_areas"`
}

// --- Responses ---

// ShopDTO is the full shop representation returned to the owner.
type ShopDTO struct {
	ID           string    `json:"id"`
	OwnerUserID  string    `json:"owner_user_id"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	LogoURL      *string   `json:"logo_url"`
	BannerURL    *string   `json:"banner_url"`
	ContactPhone string    `json:"contact_phone"`
	IsSuspended  bool      `json:"is_suspended"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// PublicShopDTO is the shop profile visible to public customers.
type PublicShopDTO struct {
	ID           string  `json:"id"`
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	LogoURL      *string `json:"logo_url"`
	BannerURL    *string `json:"banner_url"`
	ContactPhone string  `json:"contact_phone"`
}

// DeliverySettingsDTO is the delivery settings response.
type DeliverySettingsDTO struct {
	ShopID                     string   `json:"shop_id"`
	CODEnabled                 bool     `json:"cod_enabled"`
	DeliveryCharge             string   `json:"delivery_charge"`
	FreeDeliveryThreshold      *string  `json:"free_delivery_threshold"`
	AdvancePaymentRequired     bool     `json:"advance_payment_required"`
	AdvancePaymentInstructions string   `json:"advance_payment_instructions"`
	DeliveryAreas              []string `json:"delivery_areas"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

// PublicDeliverySettingsDTO excludes shop_id for the public endpoint.
type PublicDeliverySettingsDTO struct {
	CODEnabled                 bool     `json:"cod_enabled"`
	DeliveryCharge             string   `json:"delivery_charge"`
	FreeDeliveryThreshold      *string  `json:"free_delivery_threshold"`
	AdvancePaymentRequired     bool     `json:"advance_payment_required"`
	AdvancePaymentInstructions string   `json:"advance_payment_instructions"`
	DeliveryAreas              []string `json:"delivery_areas"`
}

// SlugAvailableDTO is the response for GET /api/shops/check-slug.
type SlugAvailableDTO struct {
	Available bool `json:"available"`
}

// ImageUploadDTO is the response for logo/banner uploads.
type ImageUploadDTO struct {
	URL string `json:"url"`
}
