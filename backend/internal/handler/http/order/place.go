package order

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// bdPhoneRe matches common Bangladeshi phone formats:
// 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX
var bdPhoneRe = regexp.MustCompile(`^(?:\+?880|0)1[3-9]\d{8}$`)

// PlaceOrder handles POST /api/shops/by-slug/{slug}/orders.
func (h *Handler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	var req dto.PlaceOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.CustomerName = strings.TrimSpace(req.CustomerName)
	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	req.DeliveryAddress = strings.TrimSpace(req.DeliveryAddress)
	req.DeliveryArea = strings.TrimSpace(req.DeliveryArea)
	req.Note = strings.TrimSpace(req.Note)

	if req.CustomerName == "" {
		httputil.WriteValidationError(w, "customer_name is required")
		return
	}
	if req.CustomerPhone == "" {
		httputil.WriteValidationError(w, "customer_phone is required")
		return
	}
	// Normalize phone: strip spaces, dashes, and +880/880 prefix → 01XXXXXXXXX.
	phone := strings.ReplaceAll(strings.ReplaceAll(req.CustomerPhone, " ", ""), "-", "")
	if !bdPhoneRe.MatchString(phone) {
		httputil.WriteValidationError(w, "customer_phone must be a valid BD phone number")
		return
	}
	if strings.HasPrefix(phone, "+880") {
		phone = "0" + phone[4:]
	} else if strings.HasPrefix(phone, "880") {
		phone = "0" + phone[3:]
	}
	if req.DeliveryAddress == "" {
		httputil.WriteValidationError(w, "delivery_address is required")
		return
	}
	if req.DeliveryArea == "" {
		httputil.WriteValidationError(w, "delivery_area is required")
		return
	}
	if len(req.Items) == 0 {
		httputil.WriteValidationError(w, "items must not be empty")
		return
	}
	for _, it := range req.Items {
		if it.ProductID == "" {
			httputil.WriteValidationError(w, "items[].product_id is required")
			return
		}
		if it.Quantity <= 0 {
			httputil.WriteValidationError(w, "items[].quantity must be > 0")
			return
		}
	}

	items := make([]service.OrderItemInput, 0, len(req.Items))
	for _, it := range req.Items {
		items = append(items, service.OrderItemInput{
			ProductID: it.ProductID,
			Quantity:  it.Quantity,
		})
	}

	order, err := h.svc.PlaceOrder(r.Context(), slug, service.PlaceOrderInput{
		CustomerName:    req.CustomerName,
		CustomerPhone:   phone,
		DeliveryAddress: req.DeliveryAddress,
		DeliveryArea:    req.DeliveryArea,
		Note:            req.Note,
		Items:           items,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, toOrderDTO(order))
}
