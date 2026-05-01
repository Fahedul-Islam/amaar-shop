package admin

import (
	"net/http"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// GetStats returns the platform overview headline numbers.
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.PlatformStats(r.Context())
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, stats)
}

// GetOverview bundles stats + recent shops + top shops in one round-trip.
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.svc.Overview(r.Context())
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, overview)
}

// ListShops returns paginated shops with admin-only filters.
func (h *Handler) ListShops(w http.ResponseWriter, r *http.Request) {
	f := parseListFilter(r)
	rows, total, err := h.svc.ListShops(r.Context(), f)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeListResp(w, rows, f, total)
}

// GetShop returns a single admin-enriched shop row.
func (h *Handler) GetShop(w http.ResponseWriter, r *http.Request) {
	shop, err := h.svc.GetShop(r.Context(), r.PathValue("id"))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, shop)
}

// UpdateShop accepts {is_suspended: bool} and toggles it.
func (h *Handler) UpdateShop(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IsSuspended *bool `json:"is_suspended"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if body.IsSuspended == nil {
		httputil.WriteValidationError(w, "is_suspended is required")
		return
	}
	shop, err := h.svc.SetShopSuspended(r.Context(), r.PathValue("id"), *body.IsSuspended)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, shop)
}

// ListUsers returns paginated users.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	f := parseListFilter(r)
	rows, total, err := h.svc.ListUsers(r.Context(), f)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeListResp(w, rows, f, total)
}

// ListOrders returns cross-shop orders.
func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	f := parseListFilter(r)
	rows, total, err := h.svc.ListOrders(r.Context(), f)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeListResp(w, rows, f, total)
}

// ListProducts returns cross-shop products for moderation.
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	f := parseListFilter(r)
	rows, total, err := h.svc.ListProducts(r.Context(), f)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeListResp(w, rows, f, total)
}

// UpdateProduct accepts {is_active: bool} and toggles product visibility.
func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IsActive *bool `json:"is_active"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if body.IsActive == nil {
		httputil.WriteValidationError(w, "is_active is required")
		return
	}
	id := r.PathValue("id")
	if err := h.svc.SetProductActive(r.Context(), id, *body.IsActive); err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, map[string]any{"id": id, "is_active": *body.IsActive})
}

// parseDays pulls ?days=N from the URL and clamps to a sensible default.
func parseDays(r *http.Request, fallback int) int {
	d, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if d <= 0 || d > 365 {
		return fallback
	}
	return d
}

// GetAnalytics returns the trailing-window insights snapshot.
// Default window is 30 days; admins can pass ?days=7|90|365 etc.
func (h *Handler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	report, err := h.svc.AnalyticsReport(r.Context(), parseDays(r, 30))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, report)
}

// GetFinancial returns money-and-payouts data for the trailing window.
func (h *Handler) GetFinancial(w http.ResponseWriter, r *http.Request) {
	report, err := h.svc.FinancialReport(r.Context(), parseDays(r, 30))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, report)
}

// ListAdmins returns every admin team member.
func (h *Handler) ListAdmins(w http.ResponseWriter, r *http.Request) {
	team, err := h.svc.ListAdmins(r.Context())
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, team)
}

// UpdateUserRole accepts {is_admin: bool} and promotes/demotes the user.
// Refuses to demote the caller themselves to avoid lockout.
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IsAdmin *bool `json:"is_admin"`
	}
	if err := httputil.DecodeJSONBody(r, &body); err != nil {
		httputil.WriteValidationError(w, "invalid request body")
		return
	}
	if body.IsAdmin == nil {
		httputil.WriteValidationError(w, "is_admin is required")
		return
	}
	caller := middleware.GetUserID(r.Context())
	target := r.PathValue("id")
	if err := h.svc.SetUserAdmin(r.Context(), caller, target, *body.IsAdmin); err != nil {
		httputil.WriteError(w, err)
		return
	}
	writeData(w, map[string]any{"id": target, "is_admin": *body.IsAdmin})
}
