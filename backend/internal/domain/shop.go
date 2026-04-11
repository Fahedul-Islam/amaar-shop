package domain

import (
	"errors"
	"regexp"
	"time"
)

// slugRe enforces lowercase alphanumeric + hyphens, 3–40 chars, no leading/trailing hyphen.
var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`)

// Shop represents a seller's storefront.
type Shop struct {
	ID           string    `json:"id"`
	OwnerUserID  string    `json:"owner_user_id"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	LogoURL      string    `json:"logo_url"`
	BannerURL    string    `json:"banner_url"`
	ContactPhone string    `json:"contact_phone"`
	IsSuspended  bool      `json:"is_suspended"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ValidSlug returns true if the slug matches the allowed pattern.
func ValidSlug(slug string) bool {
	return slugRe.MatchString(slug)
}

var (
	ErrShopNotFound      = errors.New("shop not found")
	ErrSlugTaken         = errors.New("slug is already taken")
	ErrShopAlreadyExists = errors.New("user already has a shop")
	ErrNotShopOwner      = errors.New("not the shop owner")
)
