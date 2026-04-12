package category

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	categories, err := h.svc.ListCategories(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.CategoryDTO, 0, len(categories))
	for _, c := range categories {
		out = append(out, toCategoryDTO(c))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req dto.CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httputil.WriteValidationError(w, "name is required")
		return
	}

	c, err := h.svc.CreateCategory(r.Context(), userID, req.Name)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toCategoryDTO(c))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	var req dto.UpdateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httputil.WriteValidationError(w, "name is required")
		return
	}

	c, err := h.svc.UpdateCategory(r.Context(), userID, id, req.Name)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toCategoryDTO(c))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	if err := h.svc.DeleteCategory(r.Context(), userID, id); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}

func (h *Handler) ListPublic(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	categories, err := h.svc.ListPublicCategories(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.PublicCategoryDTO, 0, len(categories))
	for _, c := range categories {
		out = append(out, toPublicCategoryDTO(c))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}
