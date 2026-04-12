package product

import (
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// ListPublic handles GET /api/shops/by-slug/{slug}/products.
func (h *Handler) ListPublic(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	q := r.URL.Query()
	page, size := parsePagination(q.Get("page"), q.Get("page_size"))

	filter := domain.ProductFilter{
		Query:    strings.TrimSpace(q.Get("q")),
		Page:     page,
		PageSize: size,
	}
	if cat := q.Get("category_id"); cat != "" {
		filter.CategoryID = &cat
	}

	products, total, err := h.svc.ListPublicProducts(r.Context(), slug, filter)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.PublicProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toPublicProductDTO(p))
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// GetPublic handles GET /api/shops/by-slug/{slug}/products/{id}.
func (h *Handler) GetPublic(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	id := r.PathValue("id")

	p, err := h.svc.GetPublicProduct(r.Context(), slug, id)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toPublicProductDTO(p))
}
