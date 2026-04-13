package analytics

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts analytics endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Seller analytics (authenticated)
	mux.HandleFunc("GET /api/shops/me/stats/today", auth.Then(h.TodayStats))
	mux.HandleFunc("GET /api/shops/me/stats/range", auth.Then(h.RangeStats))
	mux.HandleFunc("GET /api/shops/me/stats/top-products", auth.Then(h.TopProducts))

	// Public storefront analytics (no auth)
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/popular-products", h.PopularProducts)
}
