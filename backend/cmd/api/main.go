package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	handler "github.com/fhedul/amaarshop/backend/internal/handler/http"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/platform/logger"
	"github.com/fhedul/amaarshop/backend/internal/repository/postgres"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

func main() {
	log := logger.New()

	cfg, err := config.Load()
	if err != nil {
		log.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	log.Info("database connected")

	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		log.Error("migration failed", "error", err)
		os.Exit(1)
	}
	log.Info("migrations applied")

	// Repositories
	userRepo := postgres.NewUserRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)

	// Seed admin user if configured
	if cfg.AdminEmail != "" && cfg.AdminPass != "" {
		if err := authSvc.SeedAdmin(context.Background(), cfg.AdminEmail, cfg.AdminPass); err != nil {
			log.Error("failed to seed admin user", "error", err)
		} else {
			log.Info("admin user seeded", "email", cfg.AdminEmail)
		}
	}

	// Middleware
	mw := middleware.NewManager()
	rl := middleware.NewRateLimiter(20, 5) // 20 req/min, burst 5 for auth endpoints

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg.JWTSecret)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Ready check (verifies database connectivity)
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "not_ready", "reason": "database unreachable"})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})

	// Auth routes
	authHandler.RegisterRoutes(mux, mw, rl)

	// Wrap mux with global middleware
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      mw.Handler(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Info("server starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	log.Info("shutting down server")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("server shutdown error", "error", err)
		os.Exit(1)
	}

	log.Info("server stopped")
}
