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
	offset := 0
	if page > 1 {
		offset = (page - 1) * size
	}

	shops, total, err := h.svc.ListShops(r.Context(), query, size, offset)
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
	phone := strings.TrimSpace(req.Phone)
	if phone == "" {
		httputil.WriteValidationError(w, "phone number is required")
		return
	}

	orders, err := h.svc.LookupOrdersByPhone(r.Context(), phone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.OrderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
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
		ID:          mp.ID,
		Name:        mp.Name,
		Description: mp.Description,
		PriceBDT:    mp.PriceBDT,
		Stock:       mp.Stock,
		CategoryID:  mp.CategoryID,
		Images:      imgs,
		ShopName:    mp.ShopName,
		ShopSlug:    mp.ShopSlug,
		ShopLogoURL: mp.ShopLogoURL,
	}
}

func toMarketplaceShopDTO(s *domain.Shop) dto.MarketplaceShopDTO {
	d := dto.MarketplaceShopDTO{
		ID:           s.ID,
		Slug:         s.Slug,
		Name:         s.Name,
		Description:  s.Description,
		ContactPhone: s.ContactPhone,
	}
	if s.LogoURL != "" {
		d.LogoURL = &s.LogoURL
	}
	if s.BannerURL != "" {
		d.BannerURL = &s.BannerURL
	}
	return d
}

func toOrderDTO(o *domain.Order) dto.OrderDTO {
	items := make([]dto.OrderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, dto.OrderItemDTO{
			ID:                   it.ID,
			ProductID:            it.ProductID,
			ProductNameSnapshot:  it.ProductNameSnapshot,
			UnitPriceSnapshotBDT: it.UnitPriceSnapshotBDT,
			Quantity:             it.Quantity,
			LineTotalBDT:         it.LineTotalBDT,
		})
	}
	return dto.OrderDTO{
		ID:                     o.ID,
		ShopID:                 o.ShopID,
		CustomerName:           o.CustomerName,
		CustomerPhone:          o.CustomerPhone,
		DeliveryAddress:        o.DeliveryAddress,
		DeliveryArea:           o.DeliveryArea,
		Note:                   o.Note,
		SubtotalBDT:            o.SubtotalBDT,
		DeliveryChargeBDT:      o.DeliveryChargeBDT,
		TotalBDT:               o.TotalBDT,
		Status:                 o.Status,
		AdvancePaymentRequired: o.AdvancePaymentRequired,
		AdvancePaymentReceived: o.AdvancePaymentReceived,
		CancelledReason:        o.CancelledReason,
		Items:                  items,
		CreatedAt:              o.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:              o.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

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
