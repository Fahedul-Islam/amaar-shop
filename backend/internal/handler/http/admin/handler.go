// Package admin implements the platform-admin endpoints used by the admin dashboard.
// All routes are gated by an authenticated user with users.is_admin = true.
package admin

import (
	"context"
	"net/http"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// Service is the subset of AdminService methods the HTTP handler uses.
// Defining it as an interface here keeps the handler decoupled from the
// concrete service and easy to test with a fake.
type Service interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
	PlatformStats(ctx context.Context) (*domain.PlatformStats, error)
	Overview(ctx context.Context) (*domain.AdminOverview, error)

	ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error)
	GetShop(ctx context.Context, shopID string) (*domain.AdminShopRow, error)
	SetShopSuspended(ctx context.Context, shopID string, suspended bool) (*domain.AdminShopRow, error)

	ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error)
	ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error)
	ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error)
	SetProductActive(ctx context.Context, productID string, active bool) error

	AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error)
	FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error)
	ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error)
	SetUserAdmin(ctx context.Context, callerID, targetID string, isAdmin bool) error

	RecordFeePayment(ctx context.Context, in domain.RecordFeePaymentInput) (*domain.ShopFeePayment, error)
	FeePaymentHistory(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error)

	FeeRule(ctx context.Context) (*domain.FeeRule, error)
	UpdateFeeRule(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error)
}

// ReportService is the subset of report service methods the admin handler
// uses. Kept separate from Service so the report code can evolve without
// churning the larger admin interface.
type ReportService interface {
	List(ctx context.Context, f repository.ReportListFilter) ([]domain.AdminReportRow, int, error)
	CountByStatus(ctx context.Context) (map[string]int, error)
	FindByID(ctx context.Context, id string) (*domain.AdminReportRow, error)
	UpdateStatus(ctx context.Context, reportID, newStatus, adminNote, adminUserID string) (*domain.AdminReportRow, error)
}

// Handler implements the /api/admin/* endpoints.
type Handler struct {
	svc     Service
	reports ReportService
	cfg     *config.Config
}

func NewHandler(svc Service, reports ReportService, cfg *config.Config) *Handler {
	return &Handler{svc: svc, reports: reports, cfg: cfg}
}

// RegisterRoutes mounts every admin endpoint under /api/admin behind the
// authenticated + admin-gated middleware chain.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	gated := mw.With(middleware.Auth(h.cfg.JWTSecret), h.requireAdmin)

	mux.HandleFunc("GET /api/admin/stats", gated.Then(h.GetStats))
	mux.HandleFunc("GET /api/admin/overview", gated.Then(h.GetOverview))

	mux.HandleFunc("GET /api/admin/shops", gated.Then(h.ListShops))
	mux.HandleFunc("GET /api/admin/shops/{id}", gated.Then(h.GetShop))
	mux.HandleFunc("PATCH /api/admin/shops/{id}", gated.Then(h.UpdateShop))

	mux.HandleFunc("GET /api/admin/users", gated.Then(h.ListUsers))

	mux.HandleFunc("GET /api/admin/orders", gated.Then(h.ListOrders))

	mux.HandleFunc("GET /api/admin/products", gated.Then(h.ListProducts))
	mux.HandleFunc("PATCH /api/admin/products/{id}", gated.Then(h.UpdateProduct))

	mux.HandleFunc("GET /api/admin/analytics", gated.Then(h.GetAnalytics))
	mux.HandleFunc("GET /api/admin/financial", gated.Then(h.GetFinancial))

	mux.HandleFunc("GET /api/admin/admins", gated.Then(h.ListAdmins))
	mux.HandleFunc("PATCH /api/admin/users/{id}/role", gated.Then(h.UpdateUserRole))

	// Customer-submitted shop reports.
	mux.HandleFunc("GET /api/admin/reports", gated.Then(h.ListReports))
	mux.HandleFunc("GET /api/admin/reports/{id}", gated.Then(h.GetReport))
	mux.HandleFunc("PATCH /api/admin/reports/{id}", gated.Then(h.UpdateReport))

	// Platform-fee settlements (admin records a payment after the shop
	// owner sends the fee via bKash / bank / cash).
	mux.HandleFunc("POST /api/admin/shops/{id}/fee-payments", gated.Then(h.RecordFeePayment))
	mux.HandleFunc("GET /api/admin/shops/{id}/fee-payments", gated.Then(h.GetFeePaymentHistory))

	// Configurable platform fee rule.
	mux.HandleFunc("GET /api/admin/fee-rule", gated.Then(h.GetFeeRule))
	mux.HandleFunc("PUT /api/admin/fee-rule", gated.Then(h.UpdateFeeRule))
}

// requireAdmin asks the service whether the authenticated user is an admin.
// 403's if not. Assumes middleware.Auth has populated user_id in the context.
func (h *Handler) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		ok, err := h.svc.IsAdmin(r.Context(), userID)
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

// parseListFilter pulls page/page_size/status/role/q from the URL.
func parseListFilter(r *http.Request) domain.AdminListFilter {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	return domain.AdminListFilter{
		Status:   q.Get("status"),
		Role:     q.Get("role"),
		Query:    q.Get("q"),
		Page:     page,
		PageSize: pageSize,
	}
}

// writeListResp writes the standard `{data, pagination}` envelope.
func writeListResp(w http.ResponseWriter, data any, f domain.AdminListFilter, total int) {
	httputil.WritePaginated(w, http.StatusOK, data, map[string]any{
		"page":      f.Page,
		"page_size": f.PageSize,
		"total":     total,
	})
}

// writeData writes a single-resource envelope (no pagination).
func writeData(w http.ResponseWriter, data any) {
	httputil.WritePaginated(w, http.StatusOK, data, nil)
}
