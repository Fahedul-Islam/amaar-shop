package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

const refreshCookieName = "refresh_token"

// AuthHandler implements the auth endpoints defined in docs/API.md.
type AuthHandler struct {
	svc       *service.AuthService
	jwtSecret string
}

func NewAuthHandler(svc *service.AuthService, jwtSecret string) *AuthHandler {
	return &AuthHandler{svc: svc, jwtSecret: jwtSecret}
}

// RegisterRoutes registers all auth endpoints on the given mux.
// Rate-limited routes use the manager's With() chain; /me is protected by auth middleware.
func (h *AuthHandler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager, rl *middleware.RateLimiter) {
	rateLimited := mw.With(rl.Limit())
	authenticated := mw.With(middleware.Auth(h.jwtSecret))

	mux.HandleFunc("POST /api/auth/signup", rateLimited.Then(h.Signup))
	mux.HandleFunc("POST /api/auth/login", rateLimited.Then(h.Login))
	mux.HandleFunc("POST /api/auth/refresh", h.Refresh)
	mux.HandleFunc("POST /api/auth/logout", h.Logout)
	mux.HandleFunc("GET /api/auth/me", authenticated.Then(h.Me))
}

// Signup handles POST /api/auth/signup — registers a new seller account.
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
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
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
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
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
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
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	httputil.WriteJSON(w, http.StatusOK, dto.MessageResponse{Message: "logged out"})
}

// Me handles GET /api/auth/me — returns the authenticated user's profile.
// Auth middleware has already validated the token and set the user ID in context.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	user, err := h.svc.Me(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toUserDTO(user))
}

func (h *AuthHandler) setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(auth.RefreshTokenDuration / time.Second),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
}

func toUserDTO(u *domain.User) dto.UserDTO {
	return dto.UserDTO{
		ID:        u.ID,
		Email:     u.Email,
		IsAdmin:   u.IsAdmin,
		CreatedAt: u.CreatedAt,
	}
}

// isValidEmail performs a basic email format check.
func isValidEmail(email string) bool {
	at := strings.Index(email, "@")
	dot := strings.LastIndex(email, ".")
	return at > 0 && dot > at+1 && dot < len(email)-1
}
