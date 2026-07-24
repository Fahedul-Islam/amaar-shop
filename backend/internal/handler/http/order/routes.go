package order

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts order endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Public endpoints (no auth)
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/orders", h.PlaceOrder)
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/orders/{id}/cancel", h.BuyerCancelOrder)
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/orders/{id}/lookup", h.CustomerLookupOrder)
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/orders/{id}/advance-proof", h.SubmitAdvanceProof)
	mux.HandleFunc("PATCH /api/shops/by-slug/{slug}/orders/{id}", h.BuyerEditOrder)
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/receipt-upload", h.UploadReceipt)

	// Seller endpoints (authenticated)
	mux.HandleFunc("GET /api/shops/me/orders", auth.Then(h.ListOfOrders))
	mux.HandleFunc("GET /api/shops/me/orders/{id}", auth.Then(h.GetOrder))
	mux.HandleFunc("POST /api/shops/me/orders/{id}/status", auth.Then(h.UpdateOrder))
	mux.HandleFunc("POST /api/shops/me/orders/{id}/ship", auth.Then(h.ShipOrder))
	mux.HandleFunc("POST /api/shops/me/orders/{id}/advance-received", auth.Then(h.MarkAdvanceReceived))
}
