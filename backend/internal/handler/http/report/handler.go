// Package report exposes the public endpoint customers use to report a shop.
// Admin-side report management lives in the admin handler — this package only
// owns the unauthenticated POST endpoint.
package report

import (
	"context"
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Service is the subset of ReportService methods this handler uses.
type Service interface {
	SubmitReport(ctx context.Context, in domain.CreateReportInput) (*domain.ShopReport, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the public report endpoint. Unauthenticated by design:
// anonymous reports are allowed.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/shops/by-slug/{slug}/report", h.SubmitReport)
}

// SubmitReport accepts a customer-submitted report from the storefront.
func (h *Handler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Reason        string `json:"reason"`
		Description   string `json:"description"`
		ReporterName  string `json:"reporter_name"`
		ReporterPhone string `json:"reporter_phone"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	report, err := h.svc.SubmitReport(r.Context(), domain.CreateReportInput{
		ShopSlug:      r.PathValue("slug"),
		Reason:        body.Reason,
		Description:   body.Description,
		ReporterName:  body.ReporterName,
		ReporterPhone: body.ReporterPhone,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	// Return only what the customer needs to confirm — never leak shop_id, etc.
	httputil.WritePaginated(w, http.StatusCreated, map[string]any{
		"id":         report.ID,
		"status":     report.Status,
		"created_at": report.CreatedAt,
	}, nil)
}
