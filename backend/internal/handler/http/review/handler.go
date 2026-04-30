// Package review contains HTTP handlers for product/shop reviews.
package review

import (
	"context"
	"io"
	"net/http"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Handler exposes review endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// Service is the interface the review handler depends on.
type Service interface {
	CreateReview(ctx context.Context, in service.CreateReviewInput) (*domain.Review, error)
	UploadReviewImage(ctx context.Context, file io.Reader, filename string) (string, error)
	ListShopReviews(ctx context.Context, slug string, limit, offset int) ([]*domain.Review, int, domain.ShopRating, error)
	ListProductReviews(ctx context.Context, productID string, limit, offset int) ([]*domain.Review, int, domain.ProductRating, error)
	ListOwnerReviews(ctx context.Context, ownerUserID string, limit, offset int) ([]*domain.Review, int, domain.ShopRating, error)
	ReplyToReview(ctx context.Context, ownerUserID, reviewID, reply string) (*domain.Review, error)
}

// ListShopReviews handles GET /api/shops/by-slug/{slug}/reviews.
func (h *Handler) ListShopReviews(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	page, size := parsePagination(r.URL.Query().Get("page"), r.URL.Query().Get("page_size"))
	offset := (page - 1) * size

	reviews, total, rating, err := h.svc.ListShopReviews(r.Context(), slug, size, offset)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := dto.ReviewListDTO{
		Rating:  dto.ShopRatingDTO{Average: rating.Average, Count: rating.Count},
		Reviews: toReviewDTOs(reviews),
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// ListProductReviews handles GET /api/products/{id}/reviews.
func (h *Handler) ListProductReviews(w http.ResponseWriter, r *http.Request) {
	productID := r.PathValue("id")
	page, size := parsePagination(r.URL.Query().Get("page"), r.URL.Query().Get("page_size"))
	offset := (page - 1) * size

	reviews, total, rating, err := h.svc.ListProductReviews(r.Context(), productID, size, offset)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := struct {
		Rating  dto.ProductRatingDTO `json:"rating"`
		Reviews []dto.ReviewDTO      `json:"reviews"`
	}{
		Rating:  dto.ProductRatingDTO{Average: rating.Average, Count: rating.Count},
		Reviews: toReviewDTOs(reviews),
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// CreateReview handles POST /api/marketplace/reviews. Public endpoint:
// the customer is authenticated by passing their order_item_id + phone.
func (h *Handler) CreateReview(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateReviewRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if req.OrderItemID == "" {
		httputil.WriteValidationError(w, "order_item_id is required")
		return
	}
	if req.CustomerPhone == "" {
		httputil.WriteValidationError(w, "customer_phone is required")
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		httputil.WriteValidationError(w, "rating must be between 1 and 5")
		return
	}

	review, err := h.svc.CreateReview(r.Context(), service.CreateReviewInput{
		OrderItemID:   req.OrderItemID,
		CustomerPhone: req.CustomerPhone,
		Rating:        req.Rating,
		Body:          req.Body,
		ImageURL:      req.ImageURL,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toReviewDTO(review))
}

// UploadReviewImage handles POST /api/marketplace/reviews/image. Public:
// returns the URL the client then attaches to a CreateReview request.
func (h *Handler) UploadReviewImage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(3 << 20); err != nil { // 3 MB
		httputil.WriteValidationError(w, "invalid multipart form")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteValidationError(w, "file field is required")
		return
	}
	defer file.Close()

	url, err := h.svc.UploadReviewImage(r.Context(), file, header.Filename)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, map[string]string{"url": url})
}

// ListOwnerReviews handles GET /api/shops/me/reviews (authenticated).
func (h *Handler) ListOwnerReviews(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	page, size := parsePagination(r.URL.Query().Get("page"), r.URL.Query().Get("page_size"))
	offset := (page - 1) * size

	reviews, total, rating, err := h.svc.ListOwnerReviews(r.Context(), ownerID, size, offset)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := dto.OwnerReviewListDTO{
		Rating:  dto.ShopRatingDTO{Average: rating.Average, Count: rating.Count},
		Reviews: toOwnerReviewDTOs(reviews),
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// ReplyReview handles POST /api/shops/me/reviews/{id}/reply.
func (h *Handler) ReplyReview(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	reviewID := r.PathValue("id")

	var req dto.ReplyReviewRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}

	review, err := h.svc.ReplyToReview(r.Context(), ownerID, reviewID, req.Reply)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toOwnerReviewDTO(review))
}

// --- helpers ---

func toOwnerReviewDTOs(reviews []*domain.Review) []dto.OwnerReviewDTO {
	out := make([]dto.OwnerReviewDTO, 0, len(reviews))
	for _, r := range reviews {
		out = append(out, toOwnerReviewDTO(r))
	}
	return out
}

func toOwnerReviewDTO(r *domain.Review) dto.OwnerReviewDTO {
	d := dto.OwnerReviewDTO{
		ID:            r.ID,
		ShopID:        r.ShopID,
		ProductID:     r.ProductID,
		ProductName:   r.ProductName,
		OrderID:       r.OrderID,
		OrderItemID:   r.OrderItemID,
		CustomerName:  r.CustomerName,
		CustomerPhone: r.CustomerPhone,
		Rating:        r.Rating,
		Body:          r.Body,
		ImageURL:      r.ImageURL,
		OwnerReply:    r.OwnerReply,
		CreatedAt:     r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if r.OwnerRepliedAt != nil {
		ts := r.OwnerRepliedAt.Format("2006-01-02T15:04:05Z07:00")
		d.OwnerRepliedAt = &ts
	}
	return d
}

func toReviewDTOs(reviews []*domain.Review) []dto.ReviewDTO {
	out := make([]dto.ReviewDTO, 0, len(reviews))
	for _, r := range reviews {
		out = append(out, toReviewDTO(r))
	}
	return out
}

func toReviewDTO(r *domain.Review) dto.ReviewDTO {
	d := dto.ReviewDTO{
		ID:           r.ID,
		ShopID:       r.ShopID,
		ProductID:    r.ProductID,
		ProductName:  r.ProductName,
		OrderID:      r.OrderID,
		OrderItemID:  r.OrderItemID,
		CustomerName: r.CustomerName,
		Rating:       r.Rating,
		Body:         r.Body,
		ImageURL:     r.ImageURL,
		OwnerReply:   r.OwnerReply,
		CreatedAt:    r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if r.OwnerRepliedAt != nil {
		ts := r.OwnerRepliedAt.Format("2006-01-02T15:04:05Z07:00")
		d.OwnerRepliedAt = &ts
	}
	return d
}

func parsePagination(pageStr, sizeStr string) (page, size int) {
	page, size = 1, 20
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if sizeStr != "" {
		if s, err := strconv.Atoi(sizeStr); err == nil && s > 0 {
			size = s
		}
	}
	if size > 100 {
		size = 100
	}
	return page, size
}

func paginationDTO(page, size, total int) dto.PaginationDTO {
	pages := 0
	if size > 0 {
		pages = (total + size - 1) / size
	}
	return dto.PaginationDTO{Page: page, PageSize: size, Total: total, TotalPages: pages}
}
