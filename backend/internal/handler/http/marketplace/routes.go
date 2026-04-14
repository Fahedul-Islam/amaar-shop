package marketplace

import "net/http"

// RegisterRoutes mounts marketplace endpoints on mux. All endpoints are public (no auth).
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/marketplace/products", h.ListProducts)
	mux.HandleFunc("GET /api/marketplace/shops", h.ListShops)
	mux.HandleFunc("GET /api/marketplace/categories", h.ListCategories)
	mux.HandleFunc("POST /api/marketplace/orders/lookup", h.LookupOrders)
}
