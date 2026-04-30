package customer

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts seller customer endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Analytics first — Go's mux uses longest-pattern wins, so order here is
	// stylistic only. Listed before {phone} routes for readability.
	mux.HandleFunc("GET /api/shops/me/customers/analytics", auth.Then(h.Analytics))
	mux.HandleFunc("GET /api/shops/me/customers", auth.Then(h.List))
	mux.HandleFunc("GET /api/shops/me/customers/{phone}", auth.Then(h.Get))
	mux.HandleFunc("GET /api/shops/me/customers/{phone}/orders", auth.Then(h.Orders))
	mux.HandleFunc("PUT /api/shops/me/customers/{phone}/note", auth.Then(h.UpsertNote))
	mux.HandleFunc("DELETE /api/shops/me/customers/{phone}/note", auth.Then(h.DeleteNote))
}
