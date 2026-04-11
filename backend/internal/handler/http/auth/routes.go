package auth

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

// RegisterRoutes mounts all auth endpoints on the given mux.
// Rate-limited routes wrap signup/login; /me requires a valid access token.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager, rl *middleware.RateLimiter) {
	rateLimited := mw.With(rl.Limit())
	authenticated := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("POST /api/auth/signup", rateLimited.Then(h.Signup))
	mux.HandleFunc("POST /api/auth/login", rateLimited.Then(h.Login))
	mux.HandleFunc("POST /api/auth/refresh", h.Refresh)
	mux.HandleFunc("POST /api/auth/logout", h.Logout)
	mux.HandleFunc("GET /api/auth/me", authenticated.Then(h.Me))
}
