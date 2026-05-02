package middleware

import (
	"net/http"
	"strings"
)

// CORS applies a minimal cross-origin policy with an optional allowlist.
func CORS(allowedOrigins []string) Middleware {
	allowed := make(map[string]struct{})
	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		allowed[origin] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && originAllowed(origin, allowed) {
				applyCORSHeaders(w, r, origin)
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			} else if origin != "" && r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func originAllowed(origin string, allowed map[string]struct{}) bool {
	_, ok := allowed[origin]
	return ok
}

func applyCORSHeaders(w http.ResponseWriter, r *http.Request, origin string) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

	if reqHeaders := r.Header.Get("Access-Control-Request-Headers"); reqHeaders != "" {
		w.Header().Set("Access-Control-Allow-Headers", reqHeaders)
	} else {
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	}
	w.Header().Set("Access-Control-Max-Age", "600")
}
