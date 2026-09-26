// rudra-api is the main REST API and WebSocket server for RudraNetra.
// It exposes all endpoints consumed by the React client and admin frontends.
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

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/events"
	"github.com/rudra-netra/backend/internal/handler"
	"github.com/rudra-netra/backend/internal/handler/middleware"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	redisrepo "github.com/rudra-netra/backend/internal/repository/redis"
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

	// Initialize the PostgreSQL connection pool. The database is the only data
	// source: retry briefly on startup, then fail fast if it is unreachable.
	var pool *pgxpool.Pool
	var userRepo *postgres.UserRepository
	var vehicleRepo *postgres.VehicleRepository
	var companyRepo *postgres.CompanyRepository

	var db *postgres.DB
	for attempt := 1; attempt <= 12; attempt++ {
		db, err = postgres.NewDB(context.Background(), &cfg.Database, logger)
		if err == nil {
			break
		}
		logger.Warn("PostgreSQL not reachable, retrying",
			zap.Int("attempt", attempt), zap.Error(err))
		time.Sleep(5 * time.Second)
	}
	if err != nil || db == nil {
		logger.Fatal("PostgreSQL is required but unreachable; refusing to start", zap.Error(err))
	}
	defer db.Close()
	pool = db.Pool
	userRepo = postgres.NewUserRepository(pool)
	vehicleRepo = postgres.NewVehicleRepository(pool)
	companyRepo = postgres.NewCompanyRepository(pool)

	authService := service.NewAuthService(userRepo, &cfg.JWT)

	// Set JWT secret for auth middleware
	middleware.JWTSecret = []byte(cfg.JWT.Secret)

	// Initialize WebSocket hub
	hub := ws.NewHub(logger)
	go hub.Run()

	// Optional Redis: carries live positions from ingest to the hub and
	// commands from the API to ingest. Without it the API still serves REST.
	redisClient, err := redisrepo.NewClient(context.Background(), &cfg.Redis, logger)
	if err != nil {
		logger.Warn("redis unavailable - live WebSocket streaming and remote commands are disabled", zap.Error(err))
		redisClient = nil
	}
	if redisClient != nil {
		defer redisClient.Close()
		go subscribeLivePositions(context.Background(), redisClient, hub, logger)
		go subscribeLiveAlerts(context.Background(), redisClient, hub, logger)
	}

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
		Redis:     redisClient,
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

// subscribeLivePositions forwards positions published by the ingestion service
// to the WebSocket hub, scoped to the owning tenant.
func subscribeLivePositions(ctx context.Context, client *redisrepo.Client, hub *ws.Hub, logger *zap.Logger) {
	pubsub := client.Subscribe(ctx, events.PositionsChannel)
	defer pubsub.Close()
	channel := pubsub.Channel()

	logger.Info("subscribed to live positions channel", zap.String("channel", events.PositionsChannel))

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-channel:
			if !ok {
				return
			}
			var event domain.LiveEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				logger.Warn("invalid live position payload", zap.Error(err))
				continue
			}
			if event.DeviceID == 0 {
				continue
			}
			hub.BroadcastPosition(event.CompanyID, event.DeviceID, event)
		}
	}
}

// subscribeLiveAlerts forwards alerts raised by the worker to the WebSocket hub.
func subscribeLiveAlerts(ctx context.Context, client *redisrepo.Client, hub *ws.Hub, logger *zap.Logger) {
	pubsub := client.Subscribe(ctx, events.AlertsChannel)
	defer pubsub.Close()
	channel := pubsub.Channel()

	logger.Info("subscribed to live alerts channel", zap.String("channel", events.AlertsChannel))

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-channel:
			if !ok {
				return
			}
			var payload map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
				logger.Warn("invalid live alert payload", zap.Error(err))
				continue
			}
			companyID, _ := payload["company_id"].(float64)
			if companyID == 0 {
				continue
			}
			hub.BroadcastAlert(int64(companyID), payload)
		}
	}
}
