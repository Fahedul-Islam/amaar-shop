// Package app is the composition root: it wires repositories, services,
// storage, middleware and HTTP handlers into a single ready-to-serve http.Handler.
// Keeping DI here (instead of main.go) means main only has to worry about
// process bootstrap and lifecycle.
package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/courier"
	"github.com/fhedul/amaarshop/backend/internal/meta"
	handlerhttp "github.com/fhedul/amaarshop/backend/internal/handler/http"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/admin"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/analytics"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/auth"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/billing"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/category"
	courierhandler "github.com/fhedul/amaarshop/backend/internal/handler/http/courier"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/customer"
	marketinghandler "github.com/fhedul/amaarshop/backend/internal/handler/http/marketing"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/marketplace"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/metatracking"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/invoice"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/order"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/paymentmethod"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/product"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/report"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/reservation"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/review"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/shop"
	visithandler "github.com/fhedul/amaarshop/backend/internal/handler/http/visit"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository/postgres"
	"github.com/fhedul/amaarshop/backend/internal/service"
	localstorage "github.com/fhedul/amaarshop/backend/internal/storage/local"
	"github.com/fhedul/amaarshop/backend/internal/visit"

	"net/http"
)

// App holds the assembled application: the HTTP handler ready to serve,
// and the database handle plus background workers for lifecycle management.
type App struct {
	Handler            http.Handler
	DB                 *sql.DB
	VisitWorker        *visit.Worker
	VisitAggregator    *visit.Aggregator
	ReservationSweeper *service.ReservationSweeper
	AdSpendFiller      *service.AdSpendFiller
	MetaDispatcher     *service.MetaDispatcher
}

// New builds the full dependency graph from config and returns a ready App.
// Any construction error is wrapped with enough context to pinpoint the failed stage.
func New(ctx context.Context, cfg *config.Config, log *slog.Logger) (*App, error) {
	// --- Platform ---
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	log.Info("database connected")

	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}
	log.Info("migrations applied")

	fileStore, err := localstorage.New(cfg.UploadDir)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("init file storage: %w", err)
	}

	// --- Repositories (implement domain repository interfaces) ---
	userRepo := postgres.NewUserRepo(db)
	shopRepo := postgres.NewShopRepo(db)
	deliveryRepo := postgres.NewDeliverySettingsRepo(db)
	categoryRepo := postgres.NewCategoryRepo(db)
	productRepo := postgres.NewProductRepo(db)
	orderRepo := postgres.NewOrderRepo(db)
	analyticsRepo := postgres.NewAnalyticsRepo(db)
	marketplaceRepo := postgres.NewMarketplaceRepo(db)
	reviewRepo := postgres.NewReviewRepo(db)
	visitRepo := postgres.NewVisitRepo(db)
	customerRepo := postgres.NewCustomerRepo(db)
	adminRepo := postgres.NewAdminRepo(db)
	reportRepo := postgres.NewReportRepo(db)
	feePaymentRepo := postgres.NewFeePaymentRepo(db)
	feeRuleRepo := postgres.NewFeeRuleRepo(db)
	feeSubmissionRepo := postgres.NewFeeSubmissionRepo(db)
	paymentMethodRepo := postgres.NewPaymentMethodRepo(db)
	cartReservationRepo := postgres.NewCartReservationRepo(db)
	courierSettingsRepo := postgres.NewCourierSettingsRepo(db)
	marketingRepo := postgres.NewMarketingRepo(db)
	metaRepo := postgres.NewMetaRepo(db)

	// --- Services (depend only on repo + storage interfaces) ---
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	shopSvc := service.NewShopService(shopRepo, deliveryRepo, reviewRepo, fileStore)
	categorySvc := service.NewCategoryService(shopRepo, categoryRepo)
	productSvc := service.NewProductService(shopRepo, categoryRepo, productRepo, deliveryRepo, fileStore)
	orderSvc := service.NewOrderService(shopRepo, deliveryRepo, productRepo, orderRepo, paymentMethodRepo, cartReservationRepo)
	steadfastClient := courier.NewSteadfast(nil, cfg.SteadfastBaseURL)
	courierSvc := service.NewCourierService(shopRepo, orderRepo, courierSettingsRepo, steadfastClient)
	paymentMethodSvc := service.NewPaymentMethodService(shopRepo, deliveryRepo, paymentMethodRepo)
	cartReservationSvc := service.NewCartReservationService(shopRepo, productRepo, cartReservationRepo)
	analyticsSvc := service.NewAnalyticsService(shopRepo, analyticsRepo, visitRepo)
	marketingSvc := service.NewMarketingService(shopRepo, marketingRepo)
	metaSvc := service.NewMetaService(shopRepo, orderRepo, metaRepo)

	// Order lifecycle events feed Meta conversion tracking. Attached after
	// construction so the order service stays usable without it.
	orderSvc.SetEventPublisher(metaSvc, log)
	marketplaceSvc := service.NewMarketplaceService(marketplaceRepo, orderRepo)
	reviewSvc := service.NewReviewService(reviewRepo, shopRepo, fileStore)
	customerSvc := service.NewCustomerService(shopRepo, customerRepo)
	adminSvc := service.NewAdminService(adminRepo, userRepo, feePaymentRepo, feeRuleRepo)
	reportSvc := service.NewReportService(reportRepo, shopRepo)
	billingSvc := service.NewBillingService(feeRuleRepo, feeSubmissionRepo, feePaymentRepo, shopRepo, adminRepo)

	// Seed admin user if configured. Non-fatal: logged and ignored on failure.
	if cfg.AdminEmail != "" && cfg.AdminPass != "" {
		if err := authSvc.SeedAdmin(ctx, cfg.AdminEmail, cfg.AdminPass); err != nil {
			log.Error("failed to seed admin user", "error", err)
		} else {
			log.Info("admin user seeded", "email", cfg.AdminEmail)
		}
	}

	// --- Middleware ---
	mw := middleware.NewManager()
	mw.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	mw.Use(middleware.Logger(log))
	mw.Use(middleware.BotFilter()) // tag bot UAs so visit-tracking can skip them
	rl := middleware.NewRateLimiter(20, 5) // 20 req/min, burst 5

	// --- Background workers ---
	// Async visit pipeline: handlers Enqueue() events; the worker batches inserts.
	// Defaults are sized for ~100 visits/sec sustained throughput.
	visitWorker := visit.NewWorker(visitRepo, log, visit.Config{})
	visitWorker.Start()
	visitAggregator := visit.NewAggregator(visitRepo, log, 0, 30) // 00:30 UTC daily
	visitAggregator.Start()

	// Reservation sweeper expires holds past their TTL and restores stock.
	// Runs once a minute — finer granularity isn't needed because the
	// buyer already sees a client-side countdown.
	reservationSweeper := service.NewReservationSweeper(cartReservationRepo, log, time.Minute)
	reservationSweeper.Start()

	// Turns each shop's recurring daily ad budget into spend rows. Hourly and
	// idempotent, so a shop enabling a budget mid-day is covered promptly and a
	// restart catches up missed days.
	adSpendFiller := service.NewAdSpendFiller(marketingRepo, log, time.Hour)
	adSpendFiller.Start()

	// Delivers queued Meta conversions out-of-band, so checkout never waits on
	// (or fails because of) the Graph API.
	metaClient := meta.NewClient(nil, cfg.MetaGraphBaseURL)
	metaDispatcher := service.NewMetaDispatcher(metaRepo, orderRepo, metaClient, log, 30*time.Second)
	metaDispatcher.Start()

	// --- Handlers (depend only on service interfaces) ---
	authHandler := auth.NewHandler(authSvc, cfg)
	shopHandler := shop.NewHandler(shopSvc, cfg)
	categoryHandler := category.NewHandler(categorySvc, cfg)
	productHandler := product.NewHandler(productSvc, cfg, visitWorker)
	orderHandler := order.NewHandler(orderSvc, cfg, fileStore)
	courierHandler := courierhandler.NewHandler(courierSvc, cfg)
	paymentMethodHandler := paymentmethod.NewHandler(paymentMethodSvc, cfg)
	reservationHandler := reservation.NewHandler(cartReservationSvc, cfg)
	analyticsHandler := analytics.NewHandler(analyticsSvc, cfg)
	marketingHandler := marketinghandler.NewHandler(marketingSvc, cfg)
	metaHandler := metatracking.NewHandler(metaSvc, cfg)
	marketplaceHandler := marketplace.NewHandler(marketplaceSvc)
	reviewHandler := review.NewHandler(reviewSvc, cfg)
	visitHandler := visithandler.NewHandler(visitWorker, visitRepo)
	customerHandler := customer.NewHandler(customerSvc, cfg)
	adminHandler := admin.NewHandler(adminSvc, reportSvc, cfg)
	reportHandler := report.NewHandler(reportSvc)
	invoiceHandler := invoice.NewHandler(orderSvc, shopSvc, productSvc, analyticsSvc, cfg)
	billingHandler := billing.NewHandler(billingSvc, adminSvc, cfg)

	// --- Router ---
	handler := handlerhttp.NewRouter(handlerhttp.RouterDeps{
		DB:                 db,
		UploadDir:          cfg.UploadDir,
		AuthHandler:        authHandler,
		ShopHandler:        shopHandler,
		CategoryHandler:    categoryHandler,
		ProductHandler:     productHandler,
		OrderHandler:       orderHandler,
		CourierHandler:     courierHandler,
		PaymentMethodHandler: paymentMethodHandler,
		ReservationHandler:   reservationHandler,
		AnalyticsHandler:   analyticsHandler,
		MarketingHandler:   marketingHandler,
		MarketplaceHandler: marketplaceHandler,
		MetaHandler:        metaHandler,
		ReviewHandler:      reviewHandler,
		VisitHandler:       visitHandler,
		CustomerHandler:    customerHandler,
		AdminHandler:       adminHandler,
		ReportHandler:      reportHandler,
		InvoiceHandler:     invoiceHandler,
		BillingHandler:     billingHandler,
		Middleware:         mw,
		RateLimiter:        rl,
	})

	return &App{
		Handler:            handler,
		DB:                 db,
		VisitWorker:        visitWorker,
		VisitAggregator:    visitAggregator,
		ReservationSweeper: reservationSweeper,
		AdSpendFiller:      adSpendFiller,
		MetaDispatcher:     metaDispatcher,
	}, nil
}

// Close shuts down background workers (draining in-flight visits) and the DB.
func (a *App) Close() error {
	if a.MetaDispatcher != nil {
		a.MetaDispatcher.Stop()
	}
	if a.AdSpendFiller != nil {
		a.AdSpendFiller.Stop()
	}
	if a.ReservationSweeper != nil {
		a.ReservationSweeper.Stop()
	}
	if a.VisitAggregator != nil {
		a.VisitAggregator.Stop()
	}
	if a.VisitWorker != nil {
		a.VisitWorker.Stop()
	}
	if a.DB != nil {
		return a.DB.Close()
	}
	return nil
}
