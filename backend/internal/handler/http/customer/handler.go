package customer

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Handler implements the seller customer-management endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// List handles GET /api/shops/me/customers.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	q := r.URL.Query()
	segment := q.Get("segment")
	search := q.Get("search")
	sort := q.Get("sort")

	limit := parsePositive(q.Get("limit"), 50, 200)
	offset := parsePositive(q.Get("offset"), 0, 100000)

	customers, total, err := h.svc.List(r.Context(), ownerID, segment, search, sort, limit, offset)
	if err != nil {
		writeCustomerError(w, err)
		return
	}

	items := make([]dto.CustomerDTO, 0, len(customers))
	for _, c := range customers {
		items = append(items, toCustomerDTO(c))
	}
	httputil.WriteJSON(w, http.StatusOK, dto.CustomerListResponseDTO{Items: items, Total: total})
}

// Get handles GET /api/shops/me/customers/{phone}.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	phone := r.PathValue("phone")

	c, err := h.svc.Get(r.Context(), ownerID, phone)
	if err != nil {
		writeCustomerError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toCustomerDTO(*c))
}

// Orders handles GET /api/shops/me/customers/{phone}/orders.
func (h *Handler) Orders(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	phone := r.PathValue("phone")

	orders, err := h.svc.Orders(r.Context(), ownerID, phone)
	if err != nil {
		writeCustomerError(w, err)
		return
	}
	out := make([]dto.CustomerOrderSummaryDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, dto.CustomerOrderSummaryDTO{
			OrderID:    o.OrderID,
			TotalBDT:   o.TotalBDT,
			Status:     o.Status,
			ItemsCount: o.ItemsCount,
			CreatedAt:  o.CreatedAt,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// UpsertNote handles PUT /api/shops/me/customers/{phone}/note.
func (h *Handler) UpsertNote(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	phone := r.PathValue("phone")

	var req dto.UpsertCustomerNoteRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	if err := h.svc.UpsertNote(r.Context(), ownerID, phone, req.Note); err != nil {
		writeCustomerError(w, err)
		return
	}
	c, err := h.svc.Get(r.Context(), ownerID, phone)
	if err != nil {
		writeCustomerError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toCustomerDTO(*c))
}

// DeleteNote handles DELETE /api/shops/me/customers/{phone}/note.
func (h *Handler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	phone := r.PathValue("phone")
	if err := h.svc.DeleteNote(r.Context(), ownerID, phone); err != nil {
		writeCustomerError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}

// Analytics handles GET /api/shops/me/customers/analytics.
func (h *Handler) Analytics(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	a, err := h.svc.Analytics(r.Context(), ownerID)
	if err != nil {
		writeCustomerError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dto.CustomerAnalyticsDTO{
		TotalCustomers:     a.TotalCustomers,
		NewCount:           a.NewCount,
		ReturningCount:     a.ReturningCount,
		VIPCount:           a.VIPCount,
		InactiveCount:      a.InactiveCount,
		AvgLifetimeBDT:     a.AvgLifetimeBDT,
		TotalLifetimeBDT:   a.TotalLifetimeBDT,
		RepeatPurchaseRate: a.RepeatPurchaseRate,
	})
}

func toCustomerDTO(c domain.Customer) dto.CustomerDTO {
	return dto.CustomerDTO{
		NormalizedPhone: c.NormalizedPhone,
		DisplayPhone:    c.DisplayPhone,
		Name:            c.Name,
		DeliveryArea:    c.DeliveryArea,
		TotalOrders:     c.TotalOrders,
		TotalSpentBDT:   c.TotalSpentBDT,
		AvgOrderBDT:     c.AvgOrderBDT,
		FirstOrderAt:    c.FirstOrderAt,
		LastOrderAt:     c.LastOrderAt,
		Segment:         string(c.Segment),
		Note:            c.Note,
		NoteUpdatedAt:   c.NoteUpdatedAt,
	}
}

func writeCustomerError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrCustomerNotFound):
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{
			"error": map[string]string{"code": "not_found", "message": "customer not found"},
		})
	case errors.Is(err, domain.ErrInvalidPhone):
		httputil.WriteValidationError(w, "phone or segment is invalid")
	default:
		httputil.WriteError(w, err)
	}
}

func parsePositive(raw string, def, max int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}
