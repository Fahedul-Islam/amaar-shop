package dto

// MarketplaceProductDTO is a product with its shop info for the marketplace homepage.
type MarketplaceProductDTO struct {
	ID                    string            `json:"id"`
	Name                  string            `json:"name"`
	Description           string            `json:"description"`
	PriceBDT              string            `json:"price_bdt"`
	Stock                 int               `json:"stock"`
	CategoryID            *string           `json:"category_id"`
	DiscountType          *string           `json:"discount_type"`
	DiscountValue         *string           `json:"discount_value"`
	DeliveryChargeDhaka   *string           `json:"delivery_charge_dhaka"`
	DeliveryChargeOutside *string           `json:"delivery_charge_outside"`
	Images                []ProductImageDTO `json:"images"`
	ShopName              string            `json:"shop_name"`
	ShopSlug              string            `json:"shop_slug"`
	ShopLogoURL           string            `json:"shop_logo_url"`
	RatingAverage         float64           `json:"rating_average"`
	RatingCount           int               `json:"rating_count"`
}

// MarketplaceShopDTO is the public shop card for the marketplace.
type MarketplaceShopDTO struct {
	ID            string  `json:"id"`
	Slug          string  `json:"slug"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	LogoURL       *string `json:"logo_url"`
	BannerURL     *string `json:"banner_url"`
	ContactPhone  string  `json:"contact_phone"`
	RatingAverage float64 `json:"rating_average"`
	RatingCount   int     `json:"rating_count"`
}

// PhoneLookupRequest is the body for POST /api/marketplace/orders/lookup.
type PhoneLookupRequest struct {
	Phone string `json:"phone"`
}
