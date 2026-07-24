// Package courier exposes the seller endpoints for courier-API settings and
// one-click parcel booking.
package courier

import (
	"context"
	"errors"
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/config"
	courierapi "github.com/fhedul/amaarshop/backend/internal/courier"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Service is the interface the courier handler depends on.
type Service interface {
	GetSettings(ctx context.Context, ownerID string) (*domain.CourierSettings, error)
	UpdateSettings(ctx context.Context, ownerID, apiKey, secretKey string, enabled bool) (*domain.CourierSettings, error)
	BookCourier(ctx context.Context, ownerID, orderID string) (*domain.Order, error)
}

type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func toSettingsDTO(cs *domain.CourierSettings) dto.CourierSettingsDTO {
	return dto.CourierSettingsDTO{
		Provider:   cs.Provider,
		Enabled:    cs.IsEnabled,
		Configured: cs.Configured(),
	}
}

// GetSettings handles GET /api/shops/me/courier-settings.
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	cs, err := h.svc.GetSettings(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toSettingsDTO(cs))
}

// UpdateSettings handles PUT /api/shops/me/courier-settings.
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	var req dto.UpdateCourierSettingsRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	cs, err := h.svc.UpdateSettings(r.Context(), ownerID, req.APIKey, req.SecretKey, req.Enabled)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toSettingsDTO(cs))
}

// BookCourier handles POST /api/shops/me/orders/{id}/book-courier. Courier-side
// failures (bad phone, no balance, invalid keys) surface the courier's own
// message so the seller knows exactly what to fix.
func (h *Handler) BookCourier(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	orderID := httputil.GetIDParam(r, "id")

	order, err := h.svc.BookCourier(r.Context(), ownerID, orderID)
	if err != nil {
		var apiErr *courierapi.APIError
		if errors.As(err, &apiErr) {
			httputil.WriteFieldError(w, "courier_error", apiErr.Error())
			return
		}
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.BookCourierResponse{
		OrderID:     order.ID,
		Status:      order.Status,
		CourierName: order.CourierName,
		TrackingID:  order.TrackingID,
	})
}
