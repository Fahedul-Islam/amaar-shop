package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

const refreshCookieName = "refresh_token"

// Handler implements the /api/auth/* endpoints defined in docs/API.md.
type Handler struct {
	svc Service
	cfg *config.Config
}

// NewHandler constructs a Handler. It accepts any type satisfying the Service
// interface, decoupling it from the concrete service implementation.
// secureCookie should be true in production so refresh cookies require HTTPS;
// in development over plain HTTP, browsers and curl silently drop Secure cookies.
func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func (h *Handler) setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(auth.RefreshTokenDuration / time.Second),
		HttpOnly: true,
		Secure:   h.cfg.IsProduction(),
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
