package category

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts category endpoints on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("GET /api/shops/me/categories", auth.Then(h.List))
	mux.HandleFunc("POST /api/shops/me/categories", auth.Then(h.Create))
	mux.HandleFunc("PATCH /api/shops/me/categories/{id}", auth.Then(h.Update))
	mux.HandleFunc("DELETE /api/shops/me/categories/{id}", auth.Then(h.Delete))

	mux.HandleFunc("GET /api/shops/by-slug/{slug}/categories", h.ListPublic)
}
