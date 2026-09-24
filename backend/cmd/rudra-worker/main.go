// rudra-worker runs background jobs: scheduled reports, alert processing,
// notification dispatch, and data maintenance tasks.
package main

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/config"
)

func main() {
	// Initialize structured logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Load configuration
	_, err := config.Load("")
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// TODO: Initialize database connection pool
	// TODO: Initialize Redis client
	// TODO: Initialize NATS subscriber

	// Set up cron scheduler
	scheduler := cron.New(cron.WithSeconds())

	// Daily summary report — runs at 11:30 PM every day
	scheduler.AddFunc("0 30 23 * * *", func() {
		logger.Info("generating daily summary reports")
		// TODO: Generate and email daily reports for all companies
	})

	// Clean old position data — runs at 2 AM every day
	scheduler.AddFunc("0 0 2 * * *", func() {
		logger.Info("cleaning old position data")
		// TODO: Compress/archive positions older than retention period
	})

	// Device health check — runs every 5 minutes
	scheduler.AddFunc("0 */5 * * * *", func() {
		logger.Debug("running device health check")
		// TODO: Check for devices that haven't sent data recently
		// TODO: Update device status to 'offline' if no data for > 10 minutes
	})

	// Alert digest — runs every hour
	scheduler.AddFunc("0 0 * * * *", func() {
		logger.Debug("processing alert digest")
		// TODO: Send batched alert emails/SMS
	})

	// Invoice reminder — runs at 9 AM on the 1st of every month
	scheduler.AddFunc("0 0 9 1 * *", func() {
		logger.Info("sending invoice reminders")
		// TODO: Generate and send overdue invoice reminders
	})

	scheduler.Start()
	logger.Info("rudra-worker started with scheduled jobs")

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down worker...")
	ctx := scheduler.Stop()
	<-ctx.Done()
	logger.Info("worker stopped")
}
