// Package marketing exposes seller endpoints for ad-spend bookkeeping and the
// profit / unit-economics report that turns revenue into "am I making money?".
package marketing

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the marketing handler depends on.
type Service interface {
	RecordAdSpend(ctx context.Context, ownerID string, in service.RecordAdSpendInput) (*domain.AdSpend, error)
	ListAdSpend(ctx context.Context, ownerID string, from, to time.Time) ([]domain.AdSpend, error)
	DeleteAdSpend(ctx context.Context, ownerID, id string) error
	ProfitSummary(ctx context.Context, ownerID string, from, to time.Time) (*domain.ProfitSummary, error)
	ProductProfit(ctx context.Context, ownerID string, from, to time.Time, limit int) ([]domain.ProductProfit, error)
	ListAdBudgets(ctx context.Context, ownerID string) ([]domain.AdBudget, error)
	SetAdBudget(ctx context.Context, ownerID string, in service.SetAdBudgetInput) (*domain.AdBudget, error)
}

type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// RecordAdSpend handles POST /api/shops/me/ad-spend.
func (h *Handler) RecordAdSpend(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	var req dto.RecordAdSpendRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	entry, err := h.svc.RecordAdSpend(r.Context(), ownerID, service.RecordAdSpendInput{
		SpendDate: req.SpendDate,
		Platform:  req.Platform,
		AmountBDT: req.AmountBDT,
		Note:      req.Note,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, entry)
}

// ListAdSpend handles GET /api/shops/me/ad-spend?from=&to=.
func (h *Handler) ListAdSpend(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	from, to, ok := httputil.ParseDateRange(r)
	if !ok {
		httputil.WriteValidationError(w, "from/to must be YYYY-MM-DD with from before to")
		return
	}
	entries, err := h.svc.ListAdSpend(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, entries)
}

// DeleteAdSpend handles DELETE /api/shops/me/ad-spend/{id}.
func (h *Handler) DeleteAdSpend(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	id := httputil.GetIDParam(r, "id")
	if err := h.svc.DeleteAdSpend(r.Context(), ownerID, id); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// ProfitSummary handles GET /api/shops/me/profit-summary?from=&to=.
func (h *Handler) ProfitSummary(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	from, to, ok := httputil.ParseDateRange(r)
	if !ok {
		httputil.WriteValidationError(w, "from/to must be YYYY-MM-DD with from before to")
		return
	}
	summary, err := h.svc.ProfitSummary(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, summary)
}

// ProductProfit handles GET /api/shops/me/product-profit?from=&to=&limit=.
func (h *Handler) ProductProfit(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	from, to, ok := httputil.ParseDateRange(r)
	if !ok {
		httputil.WriteValidationError(w, "from/to must be YYYY-MM-DD with from before to")
		return
	}
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	rows, err := h.svc.ProductProfit(r.Context(), ownerID, from, to, limit)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, rows)
}

// ListAdBudgets handles GET /api/shops/me/ad-budgets.
func (h *Handler) ListAdBudgets(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	budgets, err := h.svc.ListAdBudgets(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, budgets)
}

// SetAdBudget handles PUT /api/shops/me/ad-budgets.
func (h *Handler) SetAdBudget(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	var req dto.SetAdBudgetRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	budget, err := h.svc.SetAdBudget(r.Context(), ownerID, service.SetAdBudgetInput{
		Platform:       req.Platform,
		DailyAmountBDT: req.DailyAmountBDT,
		IsActive:       req.IsActive,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, budget)
}
