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
)

// The admin dashboard spans five unrelated concerns, so the handler depends on
// five narrow interfaces rather than one wide one. Each is defined here at the
// consumer and satisfied by its own service, so a change to (say) fee
// settlement can't force the moderation screens to recompile or their fakes to
// grow new methods.

// AccessService gates the admin area and manages who else holds the keys.
type AccessService interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
	ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error)
	SetUserAdmin(ctx context.Context, callerID, targetID string, isAdmin bool) error
}

// ModerationService backs the cross-shop browse-and-act screens.
type ModerationService interface {
	ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error)
	GetShop(ctx context.Context, shopID string) (*domain.AdminShopRow, error)
	SetShopSuspended(ctx context.Context, shopID string, suspended bool) (*domain.AdminShopRow, error)
	ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error)
	ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error)
	ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error)
	SetProductActive(ctx context.Context, productID string, active bool) error
}

// InsightsService backs the read-only overview and reporting pages.
type InsightsService interface {
	PlatformStats(ctx context.Context) (*domain.PlatformStats, error)
	Overview(ctx context.Context) (*domain.AdminOverview, error)
	AnalyticsReport(ctx context.Context, days int) (*domain.AnalyticsReport, error)
	FinancialReport(ctx context.Context, days int) (*domain.FinancialReport, error)
}

// FeeService backs the platform fee rule and admin-recorded settlements.
type FeeService interface {
	FeeRule(ctx context.Context) (*domain.FeeRule, error)
	UpdateFeeRule(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error)
	RecordFeePayment(ctx context.Context, in domain.RecordFeePaymentInput) (*domain.ShopFeePayment, error)
	FeePaymentHistory(ctx context.Context, shopID string, limit int) ([]domain.ShopFeePayment, error)
}

// ReportService backs the customer-submitted shop report queue.
type ReportService interface {
	List(ctx context.Context, f domain.ReportListFilter) ([]domain.AdminReportRow, int, error)
	CountByStatus(ctx context.Context) (map[string]int, error)
	FindByID(ctx context.Context, id string) (*domain.AdminReportRow, error)
	UpdateStatus(ctx context.Context, reportID, newStatus, adminNote, adminUserID string) (*domain.AdminReportRow, error)
}

// Deps carries the handler's collaborators. A struct rather than positional
// arguments so adding a sixth concern later doesn't silently reorder a call.
type Deps struct {
	Access     AccessService
	Moderation ModerationService
	Insights   InsightsService
	Fees       FeeService
	Reports    ReportService
	Config     *config.Config
}

// Handler implements the /api/admin/* endpoints.
type Handler struct {
	access     AccessService
	moderation ModerationService
	insights   InsightsService
	fees       FeeService
	reports    ReportService
	cfg        *config.Config
}

func NewHandler(d Deps) *Handler {
	return &Handler{
		access:     d.Access,
		moderation: d.Moderation,
		insights:   d.Insights,
		fees:       d.Fees,
		reports:    d.Reports,
		cfg:        d.Config,
	}
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
		ok, err := h.access.IsAdmin(r.Context(), userID)
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
