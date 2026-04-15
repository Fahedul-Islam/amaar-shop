package product

import (
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

// Handler implements the /api/shops/me/products/* and /api/shops/by-slug/*/products endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func toImageDTO(img domain.ProductImage) dto.ProductImageDTO {
	return dto.ProductImageDTO{
		ID:        img.ID,
		ProductID: img.ProductID,
		URL:       img.URL,
		SortOrder: img.SortOrder,
		CreatedAt: img.CreatedAt,
	}
}

func toImageDTOs(imgs []domain.ProductImage) []dto.ProductImageDTO {
	out := make([]dto.ProductImageDTO, 0, len(imgs))
	for _, img := range imgs {
		out = append(out, toImageDTO(img))
	}
	return out
}

func toProductDTO(p *domain.Product) dto.ProductDTO {
	return dto.ProductDTO{
		ID:                    p.ID,
		ShopID:                p.ShopID,
		CategoryID:            p.CategoryID,
		Name:                  p.Name,
		Description:           p.Description,
		PriceBDT:              p.PriceBDT,
		Stock:                 p.Stock,
		IsActive:              p.IsActive,
		IsArchived:            p.IsArchived,
		DiscountType:          p.DiscountType,
		DiscountValue:         p.DiscountValue,
		DeliveryChargeDhaka:   p.DeliveryChargeDhaka,
		DeliveryChargeOutside: p.DeliveryChargeOutside,
		Images:                toImageDTOs(p.Images),
		CreatedAt:             p.CreatedAt,
		UpdatedAt:             p.UpdatedAt,
	}
}

func toPublicProductDTO(p *domain.Product) dto.PublicProductDTO {
	return dto.PublicProductDTO{
		ID:                    p.ID,
		Name:                  p.Name,
		Description:           p.Description,
		PriceBDT:              p.PriceBDT,
		Stock:                 p.Stock,
		CategoryID:            p.CategoryID,
		DiscountType:          p.DiscountType,
		DiscountValue:         p.DiscountValue,
		DeliveryChargeDhaka:   p.DeliveryChargeDhaka,
		DeliveryChargeOutside: p.DeliveryChargeOutside,
		Images:                toImageDTOs(p.Images),
	}
}

// parsePagination clamps page and page_size to sane defaults/limits per docs/API.md.
func parsePagination(pageStr, sizeStr string) (page, size int) {
	page = 1
	size = 20
	if pageStr != "" {
		if p, err := parseInt(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if sizeStr != "" {
		if s, err := parseInt(sizeStr); err == nil && s > 0 {
			size = s
		}
	}
	if size > 100 {
		size = 100
	}
	return page, size
}

func paginationDTO(page, size, total int) dto.PaginationDTO {
	pages := 0
	if size > 0 {
		pages = (total + size - 1) / size
	}
	return dto.PaginationDTO{Page: page, PageSize: size, Total: total, TotalPages: pages}
}
