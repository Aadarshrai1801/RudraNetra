// rudra-api is the main REST API and WebSocket server for RudraNetra.
// It exposes all endpoints consumed by the React client and admin frontends.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/handler"
	"github.com/rudra-netra/backend/internal/handler/middleware"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	"github.com/rudra-netra/backend/internal/service"
	ws "github.com/rudra-netra/backend/internal/websocket"
)

func main() {
	// Initialize structured logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load("")
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Initialize database connection pool (PostgreSQL)
	db, err := postgres.NewDB(context.Background(), &cfg.Database, logger)
	if err != nil {
		logger.Fatal("failed to connect to postgres", zap.Error(err))
	}
	defer db.Close()

	// Initialize repositories & services
	userRepo := postgres.NewUserRepository(db.Pool)
	vehicleRepo := postgres.NewVehicleRepository(db.Pool)
	companyRepo := postgres.NewCompanyRepository(db.Pool)
	authService := service.NewAuthService(userRepo, &cfg.JWT)

	// Set JWT secret for auth middleware
	middleware.JWTSecret = []byte(cfg.JWT.Secret)

	// Initialize WebSocket hub
	hub := ws.NewHub(logger)
	go hub.Run()

	// Set up Gin router
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(cfg.Server.CorsOrigins))

	// Register API routes
	deps := &handler.Dependencies{
		Hub:       hub,
		Logger:    logger,
		Auth:      authService,
		Users:     userRepo,
		Vehicles:  vehicleRepo,
		Companies: companyRepo,
		Pool:      db.Pool,
	}
	handler.RegisterRoutes(router, deps)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("starting rudra-api server", zap.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
	logger.Info("server stopped")
}
