package order

import (
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

func (h *Handler) ListOfOrders(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	page := r.URL.Query().Get("page")
	size := r.URL.Query().Get("page_size")
	status := r.URL.Query().Get("status")
	phone := r.URL.Query().Get("phone")

	orders, err := h.svc.GetShopOrders(r.Context(), ownerID, page, size, status, phone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.OrderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	orderID := httputil.GetIDParam(r, "id")

	order, err := h.svc.GetShopOrderByID(r.Context(), ownerID, orderID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}

func (h *Handler) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	orderID := httputil.GetIDParam(r, "id")

	var req dto.UpdateOrderStatusRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.Status = strings.TrimSpace(req.Status)
	if req.Status == "" {
		httputil.WriteValidationError(w, "status is required")
		return
	}

	var reason *string
	if req.CancellationReason != "" {
		trimmed := strings.TrimSpace(req.CancellationReason)
		reason = &trimmed
	}

	updated, err := h.svc.UpdateOrderStatus(r.Context(), ownerID, orderID, req.Status, reason)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(updated))
}

// BuyerCancelOrder handles POST /api/shops/by-slug/{slug}/orders/{id}/cancel.
func (h *Handler) BuyerCancelOrder(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	orderID := httputil.GetIDParam(r, "id")

	var req dto.BuyerCancelRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	req.CancellationReason = strings.TrimSpace(req.CancellationReason)

	if req.CustomerPhone == "" {
		httputil.WriteValidationError(w, "customer_phone is required")
		return
	}
	if req.CancellationReason == "" {
		httputil.WriteValidationError(w, "cancellation_reason is required")
		return
	}

	order, err := h.svc.BuyerCancelOrder(r.Context(), slug, orderID, req.CustomerPhone, req.CancellationReason)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}

// MarkAdvanceReceived handles POST /api/shops/me/orders/{id}/advance-received.
// Body may set {"received": false} to undo an earlier confirmation.
func (h *Handler) MarkAdvanceReceived(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	orderID := httputil.GetIDParam(r, "id")

	// Default to true so empty/missing body keeps the existing
	// "click to confirm" semantics.
	received := true
	if r.ContentLength > 0 {
		var req dto.MarkAdvanceReceivedRequest
		if err := httputil.DecodeJSONBody(r, &req); err == nil {
			received = req.Received
		}
	}

	order, err := h.svc.MarkAdvanceReceived(r.Context(), ownerID, orderID, received)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}

// CustomerLookupOrder handles POST /api/shops/by-slug/{slug}/orders/{id}/lookup.
func (h *Handler) CustomerLookupOrder(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	orderID := httputil.GetIDParam(r, "id")

	var req dto.CustomerLookupRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	if req.CustomerPhone == "" {
		httputil.WriteValidationError(w, "customer_phone is required")
		return
	}

	order, err := h.svc.LookupForCustomer(r.Context(), slug, orderID, req.CustomerPhone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}
