// rudra-ingest is the TCP server that accepts connections from GPS devices
// (Teltonika FMB920), decodes their binary protocol, and publishes parsed
// positions to NATS for downstream processing.
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/codec"
	"github.com/rudra-netra/backend/internal/config"
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

	// TODO: Initialize NATS connection for publishing parsed positions
	// nc, err := nats.Connect(cfg.NATS.URL)

	// TODO: Initialize database connection for IMEI → device_id lookups
	// db, err := pgxpool.New(context.Background(), cfg.Database.DSN())

	// Create TCP listener
	addr := fmt.Sprintf("%s:%d", cfg.Ingest.Host, cfg.Ingest.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Fatal("failed to start TCP listener", zap.Error(err), zap.String("addr", addr))
	}
	defer listener.Close()

	logger.Info("rudra-ingest listening for GPS devices", zap.String("addr", addr))

	// Create Teltonika codec
	teltonikaCodec := codec.NewTeltonikaCodec()

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup

	// Accept connections in a goroutine
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-ctx.Done():
					return
				default:
					logger.Error("accept error", zap.Error(err))
					continue
				}
			}

			wg.Add(1)
			go func() {
				defer wg.Done()
				handleDeviceConnection(ctx, conn, teltonikaCodec, logger)
			}()
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down ingest server...")
	cancel()
	listener.Close()
	wg.Wait()
	logger.Info("ingest server stopped")
}

// handleDeviceConnection manages the lifecycle of a single GPS device TCP connection.
// Protocol flow:
//  1. Device sends IMEI packet
//  2. Server responds with accept/reject
//  3. Device sends AVL data packets in a loop
//  4. Server responds with acknowledgment (record count)
func handleDeviceConnection(ctx context.Context, conn net.Conn, c *codec.TeltonikaCodec, logger *zap.Logger) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()
	logger.Info("device connected", zap.String("remote", remoteAddr))

	// Step 1: Read IMEI
	imeiBuf := make([]byte, 256)
	n, err := conn.Read(imeiBuf)
	if err != nil {
		logger.Error("failed to read IMEI", zap.Error(err), zap.String("remote", remoteAddr))
		return
	}

	imei, err := c.ParseIMEI(imeiBuf[:n])
	if err != nil {
		logger.Error("failed to parse IMEI", zap.Error(err), zap.String("remote", remoteAddr))
		conn.Write(codec.IMEIReject())
		return
	}

	logger.Info("device identified", zap.String("imei", imei), zap.String("remote", remoteAddr))

	// TODO: Look up device_id from database using IMEI
	// deviceID, err := deviceRepo.GetIDByIMEI(ctx, imei)
	var deviceID int64 = 0 // placeholder

	// Step 2: Accept IMEI
	conn.Write(codec.IMEIAccept())

	// Step 3: Read data packets in a loop
	dataBuf := make([]byte, 4096)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		n, err := conn.Read(dataBuf)
		if err != nil {
			if err != io.EOF {
				logger.Error("read error", zap.Error(err), zap.String("imei", imei))
			}
			logger.Info("device disconnected", zap.String("imei", imei))
			return
		}

		if n == 0 {
			continue
		}

		// Parse the data packet
		positions, err := c.ParseData(dataBuf[:n], deviceID)
		if err != nil {
			logger.Error("failed to parse data", zap.Error(err), zap.String("imei", imei))
			continue
		}

		// Step 4: Acknowledge
		conn.Write(c.Acknowledge(len(positions)))

		logger.Debug("parsed positions",
			zap.String("imei", imei),
			zap.Int("count", len(positions)),
		)

		// TODO: Publish each position to NATS
		// for _, pos := range positions {
		//     data, _ := json.Marshal(pos)
		//     nc.Publish("positions.raw", data)
		// }

		// TODO: Store positions in PostgreSQL
		// TODO: Update Redis live position cache
		// TODO: Check geofence violations
		// TODO: Check alert rules (overspeed, ignition, etc.)
		_ = positions // suppress unused warning until TODOs are implemented
	}
}
