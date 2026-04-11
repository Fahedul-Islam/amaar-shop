package shop

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// GetPublicShop handles GET /api/shops/by-slug/{slug}.
// Returns 404 for suspended shops (handled in the service layer).
func (h *Handler) GetPublicShop(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	shop, err := h.svc.GetPublicShop(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toPublicShopDTO(shop))
}

// GetPublicDeliverySettings handles GET /api/shops/by-slug/{slug}/delivery-settings.
func (h *Handler) GetPublicDeliverySettings(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	settings, err := h.svc.GetPublicDeliverySettings(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toPublicDeliverySettingsDTO(settings))
}
