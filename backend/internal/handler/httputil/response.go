// Package httputil provides shared HTTP response helpers used by handlers and middleware.
package httputil

import (
	"encoding/json"
	"errors"
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
	// Shops
	{domain.ErrShopNotFound, http.StatusNotFound, "not_found"},
	{domain.ErrSlugTaken, http.StatusConflict, "slug_taken"},
	{domain.ErrShopAlreadyExists, http.StatusConflict, "shop_already_exists"},
	{domain.ErrNotShopOwner, http.StatusForbidden, "forbidden"},
	// Delivery settings
	{domain.ErrInvalidDeliveryCharge, http.StatusBadRequest, "validation_error"},
	{domain.ErrInvalidThreshold, http.StatusBadRequest, "validation_error"},
	{domain.ErrDeliveryAreasRequired, http.StatusBadRequest, "validation_error"},
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
	{domain.ErrInvalidDeliveryArea, http.StatusBadRequest, "validation_error"},
}

// WriteError maps a domain error to the appropriate HTTP error response.
// If the error is not a known domain error, it returns 500 Internal Server Error.
func WriteError(w http.ResponseWriter, err error) {
	for _, mapping := range domainErrorMap {
		if errors.Is(err, mapping.err) {
			writeJSON(w, mapping.status, errorResponse{
				Error: errorBody{Code: mapping.code, Message: mapping.err.Error()},
			})
			return
		}
	}

	writeJSON(w, http.StatusInternalServerError, errorResponse{
		Error: errorBody{Code: "internal_error", Message: "an unexpected error occurred"},
	})
}

// WriteValidationError writes a 400 validation error response with a custom message.
func WriteValidationError(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusBadRequest, errorResponse{
		Error: errorBody{Code: "validation_error", Message: message},
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
