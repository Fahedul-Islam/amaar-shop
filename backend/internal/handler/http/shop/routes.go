package shop

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts all shop endpoints on the given mux.
// Seller endpoints require a valid access token; public endpoints are unauthenticated.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Seller endpoints (authenticated)
	mux.HandleFunc("POST /api/shops", auth.Then(h.CreateShop))
	mux.HandleFunc("GET /api/shops/me", auth.Then(h.GetMyShop))
	mux.HandleFunc("PATCH /api/shops/me", auth.Then(h.UpdateMyShop))
	mux.HandleFunc("POST /api/shops/me/logo", auth.Then(h.UploadLogo))
	mux.HandleFunc("POST /api/shops/me/banner", auth.Then(h.UploadBanner))
	mux.HandleFunc("GET /api/shops/check-slug", auth.Then(h.CheckSlug))
	mux.HandleFunc("GET /api/shops/me/delivery-settings", auth.Then(h.GetDeliverySettings))
	mux.HandleFunc("PUT /api/shops/me/delivery-settings", auth.Then(h.UpdateDeliverySettings))

	// Public endpoints
	mux.HandleFunc("GET /api/shops/by-slug/{slug}", h.GetPublicShop)
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/delivery-settings", h.GetPublicDeliverySettings)
}
