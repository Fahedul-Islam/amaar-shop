package product

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts all product endpoints on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Seller endpoints.
	mux.HandleFunc("GET /api/shops/me/products", auth.Then(h.List))
	mux.HandleFunc("POST /api/shops/me/products", auth.Then(h.Create))
	mux.HandleFunc("GET /api/shops/me/products/{id}", auth.Then(h.Get))
	mux.HandleFunc("PATCH /api/shops/me/products/{id}", auth.Then(h.Update))
	mux.HandleFunc("DELETE /api/shops/me/products/{id}", auth.Then(h.Delete))
	mux.HandleFunc("POST /api/shops/me/products/{id}/archive", auth.Then(h.Archive))

	// Image endpoints. The {id}/images/reorder route is registered before
	// {id}/images/{imageID} so the more specific pattern wins.
	mux.HandleFunc("POST /api/shops/me/products/{id}/images", auth.Then(h.UploadImage))
	mux.HandleFunc("PATCH /api/shops/me/products/{id}/images/reorder", auth.Then(h.ReorderImages))
	mux.HandleFunc("DELETE /api/shops/me/products/{id}/images/{imageID}", auth.Then(h.DeleteImage))

	// Public endpoints.
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/products", h.ListPublic)
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/products/{id}", h.GetPublic)
}
