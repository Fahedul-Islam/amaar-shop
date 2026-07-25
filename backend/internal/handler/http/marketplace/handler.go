package marketplace

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Handler implements the /api/marketplace/* endpoints.
type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// ListProducts handles GET /api/marketplace/products.
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, size := parsePagination(q.Get("page"), q.Get("page_size"))

	filter := domain.MarketplaceProductFilter{
		Query:        strings.TrimSpace(q.Get("q")),
		CategoryName: strings.TrimSpace(q.Get("category")),
		Page:         page,
		PageSize:     size,
	}

	products, total, err := h.svc.ListProducts(r.Context(), filter)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.MarketplaceProductDTO, 0, len(products))
	for _, mp := range products {
		out = append(out, toMarketplaceProductDTO(mp))
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// ListShops handles GET /api/marketplace/shops.
func (h *Handler) ListShops(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, size := parsePagination(q.Get("page"), q.Get("page_size"))
	query := strings.TrimSpace(q.Get("q"))

	shops, total, err := h.svc.ListShops(r.Context(), query, page, size)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.MarketplaceShopDTO, 0, len(shops))
	for _, s := range shops {
		out = append(out, toMarketplaceShopDTO(s))
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// ListCategories handles GET /api/marketplace/categories.
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.svc.ListCategories(r.Context())
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, categories)
}

// LookupOrders handles POST /api/marketplace/orders/lookup.
func (h *Handler) LookupOrders(w http.ResponseWriter, r *http.Request) {
	var req dto.PhoneLookupRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		httputil.WriteValidationError(w, "phone number is required")
		return
	}

	orders, err := h.svc.LookupOrdersByPhone(r.Context(), req.Phone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.MarketplaceOrderDTO, 0, len(orders))
	for _, mo := range orders {
		out = append(out, dto.MarketplaceOrderDTO{
			OrderDTO: toOrderDTO(&mo.Order),
			ShopName: mo.ShopName,
			ShopSlug: mo.ShopSlug,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// --- helpers ---

func toMarketplaceProductDTO(mp *domain.MarketplaceProduct) dto.MarketplaceProductDTO {
	imgs := make([]dto.ProductImageDTO, 0, len(mp.Images))
	for _, img := range mp.Images {
		imgs = append(imgs, dto.ProductImageDTO{
			ID:        img.ID,
			URL:       img.URL,
			SortOrder: img.SortOrder,
		})
	}
	return dto.MarketplaceProductDTO{
		ID:                    mp.ID,
		Name:                  mp.Name,
		Description:           mp.Description,
		PriceBDT:              mp.PriceBDT,
		Stock:                 mp.Stock,
		CategoryID:            mp.CategoryID,
		DiscountType:          mp.DiscountType,
		DiscountValue:         mp.DiscountValue,
		DeliveryChargeDhaka:   mp.DeliveryChargeDhaka,
		DeliveryChargeOutside: mp.DeliveryChargeOutside,
		Images:                imgs,
		ShopName:              mp.ShopName,
		ShopSlug:              mp.ShopSlug,
		ShopLogoURL:           mp.ShopLogoURL,
		RatingAverage:         mp.RatingAverage,
		RatingCount:           mp.RatingCount,
	}
}

func toMarketplaceShopDTO(s *domain.Shop) dto.MarketplaceShopDTO {
	d := dto.MarketplaceShopDTO{
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

// toOrderDTO delegates to the shared mapper (see dto.ToOrderDTO).
func toOrderDTO(o *domain.Order) dto.OrderDTO { return dto.ToOrderDTO(o) }

func parsePagination(pageStr, sizeStr string) (page, size int) {
	page = 1
	size = 20
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if sizeStr != "" {
		if s, err := strconv.Atoi(sizeStr); err == nil && s > 0 {
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
