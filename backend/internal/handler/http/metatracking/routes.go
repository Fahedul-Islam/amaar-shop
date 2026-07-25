package metatracking

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts Meta tracking settings and statistics endpoints.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("GET /api/shops/me/meta-settings", auth.Then(h.GetSettings))
	mux.HandleFunc("PUT /api/shops/me/meta-settings", auth.Then(h.UpdateSettings))

	mux.HandleFunc("GET /api/shops/me/tracking-stats", auth.Then(h.TrackingStats))
	mux.HandleFunc("GET /api/shops/me/tracking-events", auth.Then(h.RecentEvents))
	mux.HandleFunc("GET /api/shops/me/funnel", auth.Then(h.FunnelStats))
}
