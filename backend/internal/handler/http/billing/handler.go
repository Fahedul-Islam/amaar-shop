// Package billing exposes HTTP endpoints for the platform-fee settlement
// flow — both the seller side (see what I owe, submit a payment claim) and
// the admin side (review submissions, approve or reject).
//
// The fee rule itself (admin-configurable: % of GMV or fixed per order)
// is owned by the existing admin handler under /api/admin/fee-rule.
package billing

import (
	"context"
	"net/http"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Service is the slice of BillingService methods this handler uses.
type Service interface {
	MyBillingSnapshot(ctx context.Context, ownerUserID string) (*domain.ShopBillingSnapshot, error)
	SubmitPayment(ctx context.Context, ownerUserID string, in domain.CreateFeeSubmissionInput) (*domain.FeeSubmission, error)
	MySubmissions(ctx context.Context, ownerUserID string, limit int) ([]domain.FeeSubmission, error)

	ListSubmissions(ctx context.Context, f domain.FeeSubmissionListFilter) ([]domain.AdminFeeSubmissionRow, int, error)
	SubmissionCounts(ctx context.Context) (map[string]int, error)
	FindSubmission(ctx context.Context, id string) (*domain.AdminFeeSubmissionRow, error)
	ApproveSubmission(ctx context.Context, in domain.ReviewFeeSubmissionInput) (*domain.AdminFeeSubmissionRow, error)
	RejectSubmission(ctx context.Context, in domain.ReviewFeeSubmissionInput) (*domain.AdminFeeSubmissionRow, error)
}

// AdminGate matches the admin handler's IsAdmin check — kept as a tiny
// interface so this package doesn't have to depend on the admin package.
type AdminGate interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
}

type Handler struct {
	svc   Service
	admin AdminGate
	cfg   *config.Config
}

func NewHandler(svc Service, admin AdminGate, cfg *config.Config) *Handler {
	return &Handler{svc: svc, admin: admin, cfg: cfg}
}

// RegisterRoutes mounts billing endpoints. Seller routes need a logged-in
// shop owner; admin routes additionally require is_admin.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	authed := mw.With(middleware.Auth(h.cfg.JWTSecret))
	gated := mw.With(middleware.Auth(h.cfg.JWTSecret), h.requireAdmin)

	// Seller (shop owner) endpoints.
	mux.HandleFunc("GET /api/shops/me/billing", authed.Then(h.MyBilling))
	mux.HandleFunc("POST /api/shops/me/billing/submissions", authed.Then(h.SubmitPayment))
	mux.HandleFunc("GET /api/shops/me/billing/submissions", authed.Then(h.MySubmissions))

	// Admin review queue.
	mux.HandleFunc("GET /api/admin/fee-submissions", gated.Then(h.ListSubmissions))
	mux.HandleFunc("GET /api/admin/fee-submissions/{id}", gated.Then(h.GetSubmission))
	mux.HandleFunc("POST /api/admin/fee-submissions/{id}/approve", gated.Then(h.ApproveSubmission))
	mux.HandleFunc("POST /api/admin/fee-submissions/{id}/reject", gated.Then(h.RejectSubmission))
}

// requireAdmin mirrors the admin handler's gate.
func (h *Handler) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		ok, err := h.admin.IsAdmin(r.Context(), userID)
		if err != nil {
			httputil.WriteUnauthorized(w)
			return
		}
		if !ok {
			httputil.WriteForbidden(w, "admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// MyBilling returns the seller's billing snapshot.
func (h *Handler) MyBilling(w http.ResponseWriter, r *http.Request) {
	owner := middleware.GetUserID(r.Context())
	snap, err := h.svc.MyBillingSnapshot(r.Context(), owner)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, snap, nil)
}

// SubmitPayment accepts a seller's claim that they paid the platform fee.
func (h *Handler) SubmitPayment(w http.ResponseWriter, r *http.Request) {
	owner := middleware.GetUserID(r.Context())
	var body struct {
		AmountBDT     string `json:"amount_bdt"`
		PaymentMethod string `json:"payment_method"`
		TransactionID string `json:"transaction_id"`
		SenderAccount string `json:"sender_account"`
		Note          string `json:"note"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	sub, err := h.svc.SubmitPayment(r.Context(), owner, domain.CreateFeeSubmissionInput{
		AmountBDT:     body.AmountBDT,
		PaymentMethod: body.PaymentMethod,
		TransactionID: body.TransactionID,
		SenderAccount: body.SenderAccount,
		Note:          body.Note,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusCreated, sub, nil)
}

// MySubmissions returns the seller's own submission history.
func (h *Handler) MySubmissions(w http.ResponseWriter, r *http.Request) {
	owner := middleware.GetUserID(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	subs, err := h.svc.MySubmissions(r.Context(), owner, limit)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, subs, nil)
}

// ListSubmissions is the admin review queue.
func (h *Handler) ListSubmissions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	rows, total, err := h.svc.ListSubmissions(r.Context(), domain.FeeSubmissionListFilter{
		Status:   q.Get("status"),
		ShopID:   q.Get("shop_id"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	counts, err := h.svc.SubmissionCounts(r.Context())
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, map[string]any{
		"submissions": rows,
		"counts":      counts,
	}, map[string]any{
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

// GetSubmission returns one submission.
func (h *Handler) GetSubmission(w http.ResponseWriter, r *http.Request) {
	row, err := h.svc.FindSubmission(r.Context(), r.PathValue("id"))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, row, nil)
}

// ApproveSubmission marks the submission as approved and creates the
// matching fee_payment row.
func (h *Handler) ApproveSubmission(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AdminFeedback string `json:"admin_feedback"`
	}
	_ = httputil.DecodeJSONBody(r, &body) // body is optional
	row, err := h.svc.ApproveSubmission(r.Context(), domain.ReviewFeeSubmissionInput{
		SubmissionID:  r.PathValue("id"),
		AdminFeedback: body.AdminFeedback,
		AdminUserID:   middleware.GetUserID(r.Context()),
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, row, nil)
}

// RejectSubmission marks the submission as rejected with feedback.
// admin_feedback is required so the seller knows what to fix.
func (h *Handler) RejectSubmission(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AdminFeedback string `json:"admin_feedback"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if body.AdminFeedback == "" {
		httputil.WriteValidationError(w, "admin_feedback is required when rejecting")
		return
	}
	row, err := h.svc.RejectSubmission(r.Context(), domain.ReviewFeeSubmissionInput{
		SubmissionID:  r.PathValue("id"),
		AdminFeedback: body.AdminFeedback,
		AdminUserID:   middleware.GetUserID(r.Context()),
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WritePaginated(w, http.StatusOK, row, nil)
}
