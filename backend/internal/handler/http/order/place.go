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
	req.DeliveryDivision = strings.TrimSpace(req.DeliveryDivision)
	req.DeliveryDistrict = strings.TrimSpace(req.DeliveryDistrict)
	req.Note = strings.TrimSpace(req.Note)

	if req.CustomerName == "" {
		httputil.WriteFieldError(w, "name_required", "Please enter your full name.")
		return
	}
	if len(req.CustomerName) < 2 {
		httputil.WriteFieldError(w, "name_too_short", "Name is too short.")
		return
	}
	if req.CustomerPhone == "" {
		httputil.WriteFieldError(w, "phone_required", "Please enter your phone number.")
		return
	}
	// Normalize phone: strip spaces, dashes, and +880/880 prefix → 01XXXXXXXXX.
	phone := strings.ReplaceAll(strings.ReplaceAll(req.CustomerPhone, " ", ""), "-", "")
	if !bdPhoneRe.MatchString(phone) {
		httputil.WriteFieldError(w, "phone_invalid", "Phone number is invalid. Use a Bangladeshi number like 01712345678.")
		return
	}
	if strings.HasPrefix(phone, "+880") {
		phone = "0" + phone[4:]
	} else if strings.HasPrefix(phone, "880") {
		phone = "0" + phone[3:]
	}
	if req.DeliveryAddress == "" {
		httputil.WriteFieldError(w, "address_required", "Please enter a valid delivery address.")
		return
	}
	if len(req.DeliveryAddress) < 8 {
		httputil.WriteFieldError(w, "address_too_short", "Delivery address looks too short — include your house, road, and area.")
		return
	}
	// Division/District are optional — orders allowed regardless.
	// items[] is only required when a reservation_id is NOT supplied;
	// when one is, the service sources items from the reservation row.
	hasReservation := strings.TrimSpace(req.ReservationID) != ""
	if !hasReservation {
		if len(req.Items) == 0 {
			httputil.WriteFieldError(w, "items_required", "Your cart is empty.")
			return
		}
		for _, it := range req.Items {
			if it.ProductID == "" {
				httputil.WriteFieldError(w, "item_invalid", "One of the cart items is missing a product.")
				return
			}
			if it.Quantity <= 0 {
				httputil.WriteFieldError(w, "quantity_invalid", "Quantity must be at least 1.")
				return
			}
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
		CustomerName:           req.CustomerName,
		CustomerPhone:          phone,
		DeliveryAddress:        req.DeliveryAddress,
		DeliveryDivision:       req.DeliveryDivision,
		DeliveryDistrict:       req.DeliveryDistrict,
		Note:                   req.Note,
		Items:                  items,
		AdvancePaymentMethodID: strings.TrimSpace(req.AdvancePaymentMethodID),
		AdvancePaymentTxnRef:   strings.TrimSpace(req.AdvancePaymentTxnRef),
		AdvancePaymentReceipt:  strings.TrimSpace(req.AdvancePaymentReceipt),
		ReservationID:          strings.TrimSpace(req.ReservationID),
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, toOrderDTO(order))
}
