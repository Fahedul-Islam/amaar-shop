// Package http assembles the application's HTTP router.
// It wires per-feature handler packages (auth, shop) onto a single mux
// alongside health checks and static file serving.
package http

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/handler/http/analytics"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/auth"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/category"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/order"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/product"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/shop"
)

// RouterDeps holds everything the router needs to register all routes.
type RouterDeps struct {
	DB               *sql.DB
	UploadDir        string
	AuthHandler      *auth.Handler
	ShopHandler      *shop.Handler
	CategoryHandler  *category.Handler
	ProductHandler   *product.Handler
	OrderHandler     *order.Handler
	AnalyticsHandler *analytics.Handler
	Middleware       *middleware.Manager
	RateLimiter      *middleware.RateLimiter
}

// NewRouter builds the complete mux: health probes, static /uploads/,
// and all feature route groups. Returns the global-middleware-wrapped handler.
func NewRouter(deps RouterDeps) http.Handler {
	mux := http.NewServeMux()

	registerHealthRoutes(mux, deps.DB)
	registerUploadRoutes(mux, deps.UploadDir)

	deps.AuthHandler.RegisterRoutes(mux, deps.Middleware, deps.RateLimiter)
	deps.ShopHandler.RegisterRoutes(mux, deps.Middleware)
	deps.CategoryHandler.RegisterRoutes(mux, deps.Middleware)
	deps.ProductHandler.RegisterRoutes(mux, deps.Middleware)
	deps.OrderHandler.RegisterRoutes(mux, deps.Middleware)
	deps.AnalyticsHandler.RegisterRoutes(mux, deps.Middleware)

	return deps.Middleware.Handler(mux)
}

// registerHealthRoutes mounts /health and /ready liveness/readiness probes.
func registerHealthRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"status": "not_ready", "reason": "database unreachable",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
}

// registerUploadRoutes serves user-uploaded files (shop logos, banners)
// from the local upload directory. The browser hits these URLs directly
// via <img src="/uploads/logo-xxx.png"> when the frontend renders shop assets.
func registerUploadRoutes(mux *http.ServeMux, uploadDir string) {
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
