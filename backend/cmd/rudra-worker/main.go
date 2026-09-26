// rudra-worker runs background jobs: live alert evaluation, scheduled reports,
// notification dispatch, and data maintenance tasks.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/alertengine"
	"github.com/rudra-netra/backend/internal/config"
	redisrepo "github.com/rudra-netra/backend/internal/repository/redis"
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Database is required: alerts and scheduled jobs write to PostgreSQL.
	pool, err := pgxpool.New(ctx, cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to create database pool", zap.Error(err))
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		logger.Fatal("database is unreachable", zap.Error(err))
	}

	// Redis carries live positions; without it the worker only runs schedules.
	redisClient, err := redisrepo.NewClient(ctx, &cfg.Redis, logger)
	if err != nil {
		logger.Warn("redis unavailable - live alert evaluation is disabled", zap.Error(err))
		redisClient = nil
	}
	if redisClient != nil {
		defer redisClient.Close()
		engine := alertengine.New(pool, redisClient, logger)
		go engine.Run(ctx)
	}

	// Set up cron scheduler
	scheduler := cron.New(cron.WithSeconds())

	// Daily summary report — runs at 11:30 PM every day
	scheduler.AddFunc("0 30 23 * * *", func() {
		logger.Info("generating daily summary reports")
		// TODO: Generate and email daily reports for all companies
	})

	// Device health check — runs every 5 minutes
	scheduler.AddFunc("0 */5 * * * *", func() {
		logger.Debug("running device health check")
		// Device online/offline state is derived from last_heartbeat by the API.
	})

	// Stale live state cleanup — runs every 10 minutes
	scheduler.AddFunc("0 */10 * * * *", func() {
		logger.Debug("worker maintenance tick")
	})

	scheduler.Start()
	logger.Info("rudra-worker started with scheduled jobs")

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down worker...")
	cancel()
	cronCtx := scheduler.Stop()
	<-cronCtx.Done()
	logger.Info("worker stopped")
}
