package order

import (
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// SubmitAdvanceProof handles POST /api/shops/by-slug/{slug}/orders/{id}/advance-proof.
// The buyer authenticates implicitly with their phone number, and may submit
// or update advance-payment proof until the seller confirms receipt.
func (h *Handler) SubmitAdvanceProof(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	orderID := httputil.GetIDParam(r, "id")

	var req dto.SubmitAdvanceProofRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	req.PaymentMethodID = strings.TrimSpace(req.PaymentMethodID)
	req.TxnRef = strings.TrimSpace(req.TxnRef)
	req.Receipt = strings.TrimSpace(req.Receipt)

	if req.CustomerPhone == "" {
		httputil.WriteFieldError(w, "phone_required", "Please enter the phone number used for the order.")
		return
	}
	if req.PaymentMethodID == "" {
		httputil.WriteFieldError(w, "method_required", "Please choose which method you used to pay.")
		return
	}
	if req.TxnRef == "" {
		httputil.WriteFieldError(w, "txn_ref_required", "Please enter the transaction ID or reference number.")
		return
	}
	if req.Receipt == "" {
		httputil.WriteFieldError(w, "receipt_required", "Please upload your payment receipt.")
		return
	}

	order, err := h.svc.SubmitAdvanceProof(r.Context(), slug, orderID, service.SubmitAdvanceProofInput{
		CustomerPhone:   req.CustomerPhone,
		PaymentMethodID: req.PaymentMethodID,
		TxnRef:          req.TxnRef,
		Receipt:         req.Receipt,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}

// BuyerEditOrder handles PATCH /api/shops/by-slug/{slug}/orders/{id}.
// Lets the buyer fix delivery details before the seller confirms.
func (h *Handler) BuyerEditOrder(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	orderID := httputil.GetIDParam(r, "id")

	var req dto.BuyerEditOrderRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	req.DeliveryAddress = strings.TrimSpace(req.DeliveryAddress)
	req.DeliveryDivision = strings.TrimSpace(req.DeliveryDivision)
	req.DeliveryDistrict = strings.TrimSpace(req.DeliveryDistrict)
	req.Note = strings.TrimSpace(req.Note)

	if req.CustomerPhone == "" {
		httputil.WriteFieldError(w, "phone_required", "Please enter the phone number used for the order.")
		return
	}
	if req.DeliveryAddress == "" {
		httputil.WriteFieldError(w, "address_required", "Please enter a valid delivery address.")
		return
	}
	if len(req.DeliveryAddress) < 8 {
		httputil.WriteFieldError(w, "address_too_short", "Delivery address looks too short — include house, road, and area.")
		return
	}

	order, err := h.svc.BuyerEditOrder(r.Context(), slug, orderID, service.BuyerEditOrderInput{
		CustomerPhone:    req.CustomerPhone,
		DeliveryAddress:  req.DeliveryAddress,
		DeliveryDivision: req.DeliveryDivision,
		DeliveryDistrict: req.DeliveryDistrict,
		Note:             req.Note,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toOrderDTO(order))
}

// UploadReceipt handles POST /api/shops/by-slug/{slug}/receipt-upload.
// Public: any buyer can upload an advance-payment receipt and reference its
// returned URL when submitting proof. The shop slug scopes only the URL,
// not auth (the file storage is shared).
func (h *Handler) UploadReceipt(w http.ResponseWriter, r *http.Request) {
	// Cap the multipart parse at 6 MB so a malicious upload can't fill memory.
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		httputil.WriteValidationError(w, "file too large or malformed upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteValidationError(w, "file field is required")
		return
	}
	defer file.Close()

	url, err := h.fileStore.SaveReceipt(file, header.Filename)
	if err != nil {
		if err == storage.ErrInvalidFileType {
			httputil.WriteFieldError(w, "invalid_file_type", "Receipt must be a JPG, PNG, WebP image, or PDF.")
			return
		}
		if err == storage.ErrFileTooLarge {
			httputil.WriteFieldError(w, "file_too_large", "Receipt must be 5 MB or smaller.")
			return
		}
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.ReceiptUploadDTO{URL: url})
}
