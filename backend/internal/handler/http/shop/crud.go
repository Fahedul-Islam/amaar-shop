package shop

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// CreateShop handles POST /api/shops.
func (h *Handler) CreateShop(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req dto.CreateShopRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))

	if req.Name == "" {
		httputil.WriteValidationError(w, "name is required")
		return
	}
	if !domain.ValidSlug(req.Slug) {
		httputil.WriteValidationError(w, "slug must be 3-40 characters, lowercase alphanumeric and hyphens only")
		return
	}

	shop, err := h.svc.CreateShop(r.Context(), userID, req.Name, req.Slug, req.Description, req.ContactPhone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, toShopDTO(shop))
}

// GetMyShop handles GET /api/shops/me.
func (h *Handler) GetMyShop(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	shop, err := h.svc.GetMyShop(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toShopDTO(shop))
}

// UpdateMyShop handles PATCH /api/shops/me.
func (h *Handler) UpdateMyShop(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req dto.UpdateShopRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	existing, err := h.svc.GetMyShop(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	name := existing.Name
	description := existing.Description
	contactPhone := existing.ContactPhone

	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			httputil.WriteValidationError(w, "name cannot be empty")
			return
		}
	}
	if req.Description != nil {
		description = *req.Description
	}
	if req.ContactPhone != nil {
		contactPhone = *req.ContactPhone
	}

	shop, err := h.svc.UpdateShop(r.Context(), userID, name, description, contactPhone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toShopDTO(shop))
}

// CheckSlug handles GET /api/shops/check-slug?slug=...
func (h *Handler) CheckSlug(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("slug")))
	if !domain.ValidSlug(slug) {
		httputil.WriteValidationError(w, "slug must be 3-40 characters, lowercase alphanumeric and hyphens only")
		return
	}

	available, err := h.svc.CheckSlug(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.SlugAvailableDTO{Available: available})
}
