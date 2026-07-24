// Package httputil provides shared HTTP response helpers used by handlers and middleware.
package httputil

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// errorResponse is the standard JSON error envelope.
type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// domainErrorMap maps domain sentinel errors to HTTP status codes and error codes.
var domainErrorMap = []struct {
	err    error
	status int
	code   string
}{
	// Auth
	{domain.ErrUserNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrEmailAlreadyExists, http.StatusConflict, "email_already_exists"},
	{domain.ErrInvalidCredentials, http.StatusUnauthorized, "unauthorized"},
	// Admin
	{domain.ErrAdminAccessRequired, http.StatusForbidden, "forbidden"},
	{domain.ErrCannotDemoteSelf, http.StatusUnprocessableEntity, "cannot_demote_self"},
	{domain.ErrInvalidPaymentAmount, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidCoversUntil, http.StatusBadRequest, "validation_error"},
	// Reports
	{domain.ErrReportNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrInvalidReportReason, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidReportStatus, http.StatusBadRequest, "validation_error"},
	{domain.ErrReportDescriptionTooShort, http.StatusBadRequest, "validation_error"},
	{domain.ErrReportDescriptionTooLong, http.StatusBadRequest, "validation_error"},
	// Billing — fee rule + submissions
	{domain.ErrFeeRuleInvalidType, http.StatusBadRequest, "validation_error"},
	{domain.ErrFeeRuleInvalidValue, http.StatusBadRequest, "validation_error"},
	{domain.ErrFeeRulePercentTooBig, http.StatusBadRequest, "validation_error"},
	{domain.ErrSubmissionNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrInvalidSubmissionStatus, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidPaymentMethod, http.StatusBadRequest, "validation_error"},
	{domain.ErrTransactionIDRequired, http.StatusBadRequest, "validation_error"},
	{domain.ErrSubmissionAlreadyReviewed, http.StatusUnprocessableEntity, "already_reviewed"},
	{domain.ErrPendingSubmissionExists, http.StatusConflict, "pending_submission_exists"},
	// Shops
	{domain.ErrShopNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrSlugTaken, http.StatusConflict, "slug_taken"},
	{domain.ErrShopAlreadyExists, http.StatusConflict, "shop_already_exists"},
	{domain.ErrNotShopOwner, http.StatusForbidden, "forbidden"},
	// Delivery settings
	{domain.ErrInvalidDeliveryCharge, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidThreshold, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidDivision, http.StatusBadRequest, "validation_error"},
	{domain.ErrDeliveryNotConfigured, http.StatusUnprocessableEntity, "delivery_not_configured"},
	// Categories
	{domain.ErrCategoryNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrCategoryNotInShop, http.StatusUnprocessableEntity, "category_not_in_shop"},
	{domain.ErrCategoryNameTaken, http.StatusConflict, "category_name_taken"},
	// Products
	{domain.ErrProductNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrInsufficientStock, http.StatusConflict, "insufficient_stock"},
	{domain.ErrTooManyImages, http.StatusUnprocessableEntity, "too_many_images"},
	{domain.ErrInvalidPrice, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidStock, http.StatusBadRequest, "validation_error"},
	{domain.ErrProductNameRequired, http.StatusBadRequest, "validation_error"},
	// Orders
	{domain.ErrCheckoutDisabled, http.StatusUnprocessableEntity, "checkout_disabled"},
	{domain.ErrInvalidStatusTransition, http.StatusUnprocessableEntity, "invalid_status_transition"},
	{domain.ErrOrderNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrCancellationReasonRequired, http.StatusBadRequest, "validation_error"},
	{domain.ErrCourierNameRequired, http.StatusBadRequest, "validation_error"},
	{domain.ErrAdvancePaymentRequired, http.StatusUnprocessableEntity, "advance_payment_required"},
	{domain.ErrOrderLocked, http.StatusUnprocessableEntity, "order_locked"},
	// Cart reservations
	{domain.ErrReservationNotFound, http.StatusNotFound, "reservation_not_found"},
	{domain.ErrReservationExpired, http.StatusGone, "reservation_expired"},
	{domain.ErrReservationConsumed, http.StatusConflict, "reservation_consumed"},
	{domain.ErrEmptyReservation, http.StatusBadRequest, "validation_error"},
	// Payment methods
	{domain.ErrPaymentMethodNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrPaymentMethodNotInShop, http.StatusUnprocessableEntity, "payment_method_invalid"},
	{domain.ErrInvalidMethodType, http.StatusBadRequest, "validation_error"},
	{domain.ErrBankFieldsRequired, http.StatusBadRequest, "validation_error"},
	{domain.ErrMobileFieldsRequired, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidMBNumberType, http.StatusBadRequest, "validation_error"},
	// Reviews
	{domain.ErrReviewNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrReviewAlreadyExists, http.StatusConflict, "review_already_exists"},
	{domain.ErrOrderNotDelivered, http.StatusUnprocessableEntity, "order_not_delivered"},
	{domain.ErrInvalidRating, http.StatusBadRequest, "validation_error"},
	{domain.ErrReplyAlreadyExists, http.StatusConflict, "reply_already_exists"},
	{domain.ErrEmptyReply, http.StatusBadRequest, "validation_error"},
}

// WriteError maps a domain error to the appropriate HTTP error response.
// Unmapped errors are logged at ERROR with the full message and surfaced to
// the client as a 500 with the underlying message so frontend devs and
// testers can debug without reading server logs. Sentinel domain errors
// remain user-friendly.
func WriteError(w http.ResponseWriter, err error) {
	for _, mapping := range domainErrorMap {
		if errors.Is(err, mapping.err) {
			writeJSON(w, mapping.status, errorResponse{
				Error: errorBody{Code: mapping.code, Message: mapping.err.Error()},
			})
			return
		}
	}

	// Unmapped error — log it so it appears in backend logs alongside the
	// request line, and echo the underlying message in the response.
	slog.Error("unhandled error in handler", "error", err.Error())
	writeJSON(w, http.StatusInternalServerError, errorResponse{
		Error: errorBody{Code: "internal_error", Message: err.Error()},
	})
}

// WriteValidationError writes a 400 validation error response with a custom message.
func WriteValidationError(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusBadRequest, errorResponse{
		Error: errorBody{Code: "validation_error", Message: message},
	})
}

// WriteFieldError writes a 400 validation error with a specific code so the
// frontend can highlight the offending field. Use for per-field handler-level
// validation where domain errors don't apply.
func WriteFieldError(w http.ResponseWriter, code, message string) {
	writeJSON(w, http.StatusBadRequest, errorResponse{
		Error: errorBody{Code: code, Message: message},
	})
}

// WriteForbidden writes a 403 forbidden error response.
func WriteForbidden(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusForbidden, errorResponse{
		Error: errorBody{Code: "forbidden", Message: message},
	})
}

// WriteUnauthorized writes a 401 unauthorized error response.
func WriteUnauthorized(w http.ResponseWriter) {
	writeJSON(w, http.StatusUnauthorized, errorResponse{
		Error: errorBody{Code: "unauthorized", Message: "missing or invalid access token"},
	})
}

// WriteJSON writes a JSON success response wrapping data in {"data": ...}.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	writeJSON(w, status, map[string]interface{}{"data": data})
}

// WritePaginated writes a {"data": ..., "pagination": ...} envelope used by
// list endpoints per docs/API.md.
func WritePaginated(w http.ResponseWriter, status int, data, pagination interface{}) {
	writeJSON(w, status, map[string]interface{}{
		"data":       data,
		"pagination": pagination,
	})
}

// WriteNoContent writes a 204 No Content response.
func WriteNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func GetIDParam(r *http.Request, name string) string {
	return r.PathValue(name)
}

func DecodeJSONBody(r *http.Request, dst interface{}) error {
	if r.Body == nil {
		return errors.New("request body is required")
	}
	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		return err
	}

	return nil
}
