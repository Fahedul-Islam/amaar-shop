package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Signup handles POST /api/auth/signup — registers a new seller account.
func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req dto.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || !isValidEmail(req.Email) {
		httputil.WriteValidationError(w, "valid email is required")
		return
	}
	if len(req.Password) < 8 {
		httputil.WriteValidationError(w, "password must be at least 8 characters")
		return
	}

	user, tokens, err := h.svc.Signup(r.Context(), req.Email, req.Password)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	h.setRefreshCookie(w, tokens.RefreshToken)
	httputil.WriteJSON(w, http.StatusCreated, dto.AuthResponse{
		AccessToken: tokens.AccessToken,
		User:        toUserDTO(user),
	})
}

// Login handles POST /api/auth/login — authenticates an existing user.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" {
		httputil.WriteValidationError(w, "email is required")
		return
	}
	if req.Password == "" {
		httputil.WriteValidationError(w, "password is required")
		return
	}

	user, tokens, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	h.setRefreshCookie(w, tokens.RefreshToken)
	httputil.WriteJSON(w, http.StatusOK, dto.AuthResponse{
		AccessToken: tokens.AccessToken,
		User:        toUserDTO(user),
	})
}

// Refresh handles POST /api/auth/refresh — exchanges a refresh cookie for a new access token.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil {
		httputil.WriteUnauthorized(w)
		return
	}

	accessToken, err := h.svc.Refresh(r.Context(), cookie.Value)
	if err != nil {
		httputil.WriteUnauthorized(w)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.TokenResponse{AccessToken: accessToken})
}

// Logout handles POST /api/auth/logout — clears the refresh token cookie.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cfg.IsProduction(),
		SameSite: http.SameSiteStrictMode,
	})

	httputil.WriteJSON(w, http.StatusOK, dto.MessageResponse{Message: "logged out"})
}

// Me handles GET /api/auth/me — returns the authenticated user's profile.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	user, err := h.svc.Me(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toUserDTO(user))
}
