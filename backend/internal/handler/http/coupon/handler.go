package coupon

import (
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
	"net/http"
	"time"
)

type Handler struct {
	svc    *service.CouponService
	secret string
}

func NewHandler(s *service.CouponService, secret string) *Handler { return &Handler{s, secret} }
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.secret))
	mux.HandleFunc("GET /api/shops/me/coupons", auth.Then(h.List))
	mux.HandleFunc("POST /api/shops/me/coupons", auth.Then(h.Create))
	mux.HandleFunc("DELETE /api/shops/me/coupons/{id}", auth.Then(h.Disable))
}
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.List(r.Context(), middleware.GetUserID(r.Context()))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount  string    `json:"amount_bdt"`
		Phone   string    `json:"buyer_phone"`
		Expires time.Time `json:"expires_at"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "Enter a discount and valid expiry date.")
		return
	}
	c, err := h.svc.Create(r.Context(), middleware.GetUserID(r.Context()), req.Amount, req.Phone, req.Expires)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, c)
}
func (h *Handler) Disable(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Disable(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id")); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}
