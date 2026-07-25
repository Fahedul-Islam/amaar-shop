package marketing

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts ad-spend and profit endpoints on mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("GET /api/shops/me/ad-spend", auth.Then(h.ListAdSpend))
	mux.HandleFunc("POST /api/shops/me/ad-spend", auth.Then(h.RecordAdSpend))
	mux.HandleFunc("DELETE /api/shops/me/ad-spend/{id}", auth.Then(h.DeleteAdSpend))

	mux.HandleFunc("GET /api/shops/me/ad-budgets", auth.Then(h.ListAdBudgets))
	mux.HandleFunc("PUT /api/shops/me/ad-budgets", auth.Then(h.SetAdBudget))

	mux.HandleFunc("GET /api/shops/me/profit-summary", auth.Then(h.ProfitSummary))
	mux.HandleFunc("GET /api/shops/me/product-profit", auth.Then(h.ProductProfit))
}
