package review

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts review endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Public
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/reviews", h.ListShopReviews)
	mux.HandleFunc("GET /api/products/{id}/reviews", h.ListProductReviews)
	mux.HandleFunc("POST /api/marketplace/reviews", h.CreateReview)
	mux.HandleFunc("POST /api/marketplace/reviews/image", h.UploadReviewImage)

	// Owner-authenticated
	mux.HandleFunc("GET /api/shops/me/reviews", auth.Then(h.ListOwnerReviews))
	mux.HandleFunc("POST /api/shops/me/reviews/{id}/reply", auth.Then(h.ReplyReview))
}
