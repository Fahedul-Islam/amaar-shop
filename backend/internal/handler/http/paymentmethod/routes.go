package paymentmethod

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// RegisterRoutes mounts payment-method endpoints.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	// Seller-side CRUD
	mux.HandleFunc("GET /api/shops/me/payment-methods", auth.Then(h.list))
	mux.HandleFunc("POST /api/shops/me/payment-methods", auth.Then(h.create))
	mux.HandleFunc("PATCH /api/shops/me/payment-methods/{id}", auth.Then(h.update))
	mux.HandleFunc("DELETE /api/shops/me/payment-methods/{id}", auth.Then(h.delete))

	// Public read for buyer checkout
	mux.HandleFunc("GET /api/shops/by-slug/{slug}/payment-methods", h.publicList)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	methods, err := h.svc.ListMine(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	out := make([]dto.PaymentMethodDTO, 0, len(methods))
	for _, m := range methods {
		out = append(out, toDTO(m))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) publicList(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	methods, err := h.svc.ListPublicBySlug(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	out := make([]dto.PaymentMethodDTO, 0, len(methods))
	for _, m := range methods {
		out = append(out, toPublicDTO(m))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	var req dto.PaymentMethodRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	m, err := h.svc.Create(r.Context(), ownerID, fromRequest(&req))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toDTO(m))
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	methodID := r.PathValue("id")

	var req dto.PaymentMethodRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	m, err := h.svc.Update(r.Context(), ownerID, methodID, fromRequest(&req))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toDTO(m))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	methodID := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), ownerID, methodID); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}
