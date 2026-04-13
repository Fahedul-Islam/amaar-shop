package analytics

import (
	"net/http"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Handler implements the analytics endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// TodayStats handles GET /api/shops/me/stats/today.
func (h *Handler) TodayStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	stats, err := h.svc.TodayStats(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.TodayStatsDTO{
		TotalOrders:   stats.TotalOrders,
		PendingOrders: stats.PendingOrders,
		RevenueBDT:    stats.RevenueBDT,
		Date:          stats.Date,
	})
}

// RangeStats handles GET /api/shops/me/stats/range?from=...&to=...
func (h *Handler) RangeStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	if fromStr == "" || toStr == "" {
		httputil.WriteValidationError(w, "from and to query parameters are required (YYYY-MM-DD)")
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		httputil.WriteValidationError(w, "from must be a valid date (YYYY-MM-DD)")
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		httputil.WriteValidationError(w, "to must be a valid date (YYYY-MM-DD)")
		return
	}
	if to.Before(from) {
		httputil.WriteValidationError(w, "to must not be before from")
		return
	}
	if to.Sub(from).Hours() > 90*24 {
		httputil.WriteValidationError(w, "date range must not exceed 90 days")
		return
	}

	stats, err := h.svc.RangeStats(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.DayStatDTO, 0, len(stats))
	for _, s := range stats {
		out = append(out, dto.DayStatDTO{
			Date:       s.Date,
			Orders:     s.Orders,
			RevenueBDT: s.RevenueBDT,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// TopProducts handles GET /api/shops/me/stats/top-products.
func (h *Handler) TopProducts(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	products, err := h.svc.TopProducts(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.TopProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, dto.TopProductDTO{
			ProductID:       p.ProductID,
			ProductName:     p.ProductName,
			TotalQuantity:   p.TotalQuantity,
			TotalRevenueBDT: p.TotalRevenueBDT,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// PopularProducts handles GET /api/shops/by-slug/{slug}/popular-products.
func (h *Handler) PopularProducts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	products, err := h.svc.PopularProducts(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.PopularProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, dto.PopularProductDTO{
			ProductID:     p.ProductID,
			ProductName:   p.ProductName,
			TotalQuantity: p.TotalQuantity,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}
