package order

import (
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
	"net/http"
)

func (h *Handler) Quote(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []struct {
			ProductID string `json:"product_id"`
			Quantity  int    `json:"quantity"`
		} `json:"items"`
		Division      string `json:"delivery_division"`
		Phone         string `json:"customer_phone"`
		Code          string `json:"coupon_code"`
		ReservationID string `json:"reservation_id"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32768)
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid checkout request")
		return
	}
	if len(req.Items) == 0 || len(req.Items) > 100 || len(req.Phone) > 30 || len(req.Code) > 64 || (req.Division != "" && !domain.AllowedDivisions[req.Division]) {
		httputil.WriteValidationError(w, "Check your cart and delivery division.")
		return
	}
	in := service.PlaceOrderInput{DeliveryDivision: req.Division, CustomerPhone: req.Phone, CouponCode: req.Code, ReservationID: req.ReservationID}
	for _, it := range req.Items {
		if it.Quantity < 1 || it.Quantity > 10000 || len(it.ProductID) != 36 {
			httputil.WriteValidationError(w, "invalid cart item")
			return
		}
		in.Items = append(in.Items, service.OrderItemInput{ProductID: it.ProductID, Quantity: it.Quantity})
	}
	quote, err := h.svc.Quote(r.Context(), r.PathValue("slug"), in)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"subtotal_bdt": quote.SubtotalBDT, "delivery_charge_bdt": quote.DeliveryChargeBDT, "total_bdt": quote.TotalBDT, "coupon_code": quote.CouponCode, "coupon_discount_bdt": quote.CouponDiscountBDT, "advance_payment_required": quote.AdvancePaymentRequired})
}
