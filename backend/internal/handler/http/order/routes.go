package order

import "net/http"

// RegisterRoutes mounts the public order endpoint.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/orders", h.PlaceOrder)
}
