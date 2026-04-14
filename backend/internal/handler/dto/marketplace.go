package dto

// MarketplaceProductDTO is a product with its shop info for the marketplace homepage.
type MarketplaceProductDTO struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	PriceBDT    string            `json:"price_bdt"`
	Stock       int               `json:"stock"`
	CategoryID  *string           `json:"category_id"`
	Images      []ProductImageDTO `json:"images"`
	ShopName    string            `json:"shop_name"`
	ShopSlug    string            `json:"shop_slug"`
	ShopLogoURL string            `json:"shop_logo_url"`
}

// MarketplaceShopDTO is the public shop card for the marketplace.
type MarketplaceShopDTO struct {
	ID           string  `json:"id"`
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	LogoURL      *string `json:"logo_url"`
	BannerURL    *string `json:"banner_url"`
	ContactPhone string  `json:"contact_phone"`
}

// PhoneLookupRequest is the body for POST /api/marketplace/orders/lookup.
type PhoneLookupRequest struct {
	Phone string `json:"phone"`
}
