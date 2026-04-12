package category

import (
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

// Handler implements the /api/shops/me/categories and
// /api/shops/by-slug/{slug}/categories endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func toCategoryDTO(c *domain.Category) dto.CategoryDTO {
	return dto.CategoryDTO{
		ID:        c.ID,
		ShopID:    c.ShopID,
		Name:      c.Name,
		CreatedAt: c.CreatedAt,
	}
}

func toPublicCategoryDTO(c *domain.Category) dto.PublicCategoryDTO {
	return dto.PublicCategoryDTO{ID: c.ID, Name: c.Name}
}
