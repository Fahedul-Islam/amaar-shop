package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// Auth validates the Bearer access token and injects the user ID into the request context.
// Returns 401 if the token is missing or invalid.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				httputil.WriteUnauthorized(w)
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				httputil.WriteUnauthorized(w)
				return
			}

			claims, err := auth.ValidateToken(parts[1], jwtSecret, "access")
			if err != nil {
				httputil.WriteUnauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts the authenticated user ID from the request context.
func GetUserID(ctx context.Context) string {
	id, _ := ctx.Value(UserIDKey).(string)
	return id
}
