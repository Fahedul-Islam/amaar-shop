// Package reservation contains HTTP handlers for buyer-facing cart
// reservations.
package reservation

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the handler depends on.
type Service interface {
	CreateReservation(ctx context.Context, slug string, items []service.ReserveItemInput) (*domain.CartReservation, error)
	GetReservation(ctx context.Context, slug, id string) (*domain.CartReservation, error)
	CancelReservation(ctx context.Context, slug, id string) (*domain.CartReservation, error)
}

type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// RegisterRoutes mounts the public reservation endpoints.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, _ *middleware.Manager) {
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/cart-reservations", h.create)
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/cart-reservations/{id}", h.get)
	mux.HandleFunc("DELETE /api/shops/by-slug/{slug}/cart-reservations/{id}", h.cancel)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	var req dto.CreateReservationRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	if len(req.Items) == 0 {
		httputil.WriteFieldError(w, "items_required", "Your cart is empty.")
		return
	}
	in := make([]service.ReserveItemInput, 0, len(req.Items))
	for _, it := range req.Items {
		if strings.TrimSpace(it.ProductID) == "" || it.Quantity <= 0 {
			httputil.WriteFieldError(w, "item_invalid", "One of the cart items is missing or has an invalid quantity.")
			return
		}
		in = append(in, service.ReserveItemInput{
			ProductID: it.ProductID,
			Quantity:  it.Quantity,
		})
	}

	res, err := h.svc.CreateReservation(r.Context(), slug, in)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toDTO(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	id := r.PathValue("id")
	res, err := h.svc.GetReservation(r.Context(), slug, id)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toDTO(res))
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	id := r.PathValue("id")
	res, err := h.svc.CancelReservation(r.Context(), slug, id)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toDTO(res))
}

func toDTO(r *domain.CartReservation) dto.CartReservationDTO {
	items := make([]dto.CartReservationItemDTO, 0, len(r.Items))
	for _, it := range r.Items {
		items = append(items, dto.CartReservationItemDTO{
			ID:        it.ID,
			ProductID: it.ProductID,
			Quantity:  it.Quantity,
		})
	}
	return dto.CartReservationDTO{
		ID:            r.ID,
		ShopID:        r.ShopID,
		Status:        r.Status,
		ExpiresAt:     r.ExpiresAt.Format(time.RFC3339),
		CreatedAt:     r.CreatedAt.Format(time.RFC3339),
		Items:         items,
		CustomerPhone: r.CustomerPhone,
	}
}
