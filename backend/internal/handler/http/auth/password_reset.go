package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

type PasswordResetService interface {
	Request(context.Context, string) error
	Reset(context.Context, string, string, string) error
}

func (h *Handler) WithPasswordReset(s PasswordResetService) *Handler { h.reset = s; return h }
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid request")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if !isValidEmail(req.Email) || len(req.Email) > 254 {
		httputil.WriteValidationError(w, "enter a valid email address")
		return
	}
	if err := h.reset.Request(r.Context(), req.Email); err != nil {
		slog.Error("password reset delivery failed", "error", err)
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "If an account exists for this email, a code will arrive shortly. You can request another code after 60 seconds."})
}
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid request")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	validCode := len(req.Code) == 6
	for _, c := range req.Code {
		if c < '0' || c > '9' {
			validCode = false
		}
	}
	if !isValidEmail(req.Email) || len(req.Email) > 254 || !validCode || len(req.Password) < 8 || len(req.Password) > 72 {
		httputil.WriteValidationError(w, "Enter your email, six-digit code, and a password between 8 and 72 bytes.")
		return
	}
	if err := h.reset.Reset(r.Context(), req.Email, req.Code, req.Password); err != nil {
		httputil.WriteValidationError(w, "Invalid or expired code. Request a new code and try again.")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "Password updated. Sign in with your new password."})
}
