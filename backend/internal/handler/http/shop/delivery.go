package shop

import (
	"encoding/json"
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// GetDeliverySettings handles GET /api/shops/me/delivery-settings.
func (h *Handler) GetDeliverySettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	settings, err := h.svc.GetDeliverySettings(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toDeliverySettingsDTO(settings))
}

// UpdateDeliverySettings handles PUT /api/shops/me/delivery-settings.
func (h *Handler) UpdateDeliverySettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req dto.UpdateDeliverySettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	if req.DeliveryAreas == nil {
		req.DeliveryAreas = []string{}
	}

	ds := &domain.DeliverySettings{
		CODEnabled:                 req.CODEnabled,
		DeliveryCharge:             req.DeliveryCharge,
		FreeDeliveryThreshold:      req.FreeDeliveryThreshold,
		AdvancePaymentRequired:     req.AdvancePaymentRequired,
		AdvancePaymentInstructions: req.AdvancePaymentInstructions,
		DeliveryAreas:              req.DeliveryAreas,
	}

	settings, err := h.svc.UpdateDeliverySettings(r.Context(), userID, ds)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toDeliverySettingsDTO(settings))
}
