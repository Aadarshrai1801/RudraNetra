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
	"github.com/jackc/pgx/v5/pgxpool"
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

	// Initialize database connection pool (PostgreSQL) if available
	var pool *pgxpool.Pool
	var userRepo *postgres.UserRepository
	var vehicleRepo *postgres.VehicleRepository
	var companyRepo *postgres.CompanyRepository

	db, err := postgres.NewDB(context.Background(), &cfg.Database, logger)
	if err != nil {
		logger.Warn("PostgreSQL not reachable — running in standalone mode with full in-memory fallback", zap.Error(err))
	} else {
		defer db.Close()
		pool = db.Pool
		userRepo = postgres.NewUserRepository(pool)
		vehicleRepo = postgres.NewVehicleRepository(pool)
		companyRepo = postgres.NewCompanyRepository(pool)
	}

	authService := service.NewAuthService(userRepo, &cfg.JWT)

	// Set JWT secret for auth middleware
	middleware.JWTSecret = []byte(cfg.JWT.Secret)

	// Initialize WebSocket hub
	hub := ws.NewHub(logger)
	go hub.Run()

	// Live vehicle movement simulator for WebSocket connected clients
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		step := 0
		for range ticker.C {
			step++
			// Allied Transport vehicle 1 (DXB-K-94821)
			lat1 := 25.2048 + float64(step%40)*0.0006
			lng1 := 55.2708 + float64(step%40)*0.0004
			spd1 := 62.0 + float64((step*7)%15)
			hub.BroadcastPosition(1, 101, map[string]interface{}{
				"device_id":   101,
				"reg_number":  "DXB-K-94821",
				"lat":         lat1,
				"lng":         lng1,
				"speed":       spd1,
				"heading":     95.0,
				"ignition":    true,
				"status":      "moving",
				"temperature": -18.2,
				"timestamp":   time.Now().Format(time.RFC3339),
			})

			// Allied Transport vehicle 4 (DXB-N-77319)
			lat4 := 25.0757 + float64((step+15)%35)*0.0005
			lng4 := 55.1403 + float64((step+15)%35)*0.0003
			spd4 := 58.0 + float64((step*5)%18)
			hub.BroadcastPosition(1, 104, map[string]interface{}{
				"device_id":   104,
				"reg_number":  "DXB-N-77319",
				"lat":         lat4,
				"lng":         lng4,
				"speed":       spd4,
				"heading":     215.0,
				"ignition":    true,
				"status":      "moving",
				"temperature": 3.8,
				"timestamp":   time.Now().Format(time.RFC3339),
			})

			// EKSC vehicle (DXB-M-11234)
			lat6 := 25.1972 + float64(step%30)*0.0004
			lng6 := 55.2744 + float64(step%30)*0.0005
			spd6 := 45.0 + float64((step*3)%12)
			hub.BroadcastPosition(2, 201, map[string]interface{}{
				"device_id":   201,
				"reg_number":  "DXB-M-11234",
				"lat":         lat6,
				"lng":         lng6,
				"speed":       spd6,
				"heading":     110.0,
				"ignition":    true,
				"status":      "moving",
				"timestamp":   time.Now().Format(time.RFC3339),
			})
		}
	}()

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
		Pool:      pool,
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
