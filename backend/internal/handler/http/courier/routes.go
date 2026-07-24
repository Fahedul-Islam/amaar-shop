package courier

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts courier settings + booking endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("GET /api/shops/me/courier-settings", auth.Then(h.GetSettings))
	mux.HandleFunc("PUT /api/shops/me/courier-settings", auth.Then(h.UpdateSettings))
	mux.HandleFunc("POST /api/shops/me/orders/{id}/book-courier", auth.Then(h.BookCourier))
}
