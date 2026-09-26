// rudra-ingest is the TCP server that accepts connections from GPS devices
// (Teltonika FMB920), decodes their binary protocol, persists decoded AVL
// records to PostgreSQL/TimescaleDB and keeps live device state in the DB.
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
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/codec"
	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/repository/postgres"
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

	// Database is the source of truth: device registry and position storage.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to create database pool", zap.Error(err))
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		logger.Fatal("database is unreachable", zap.Error(err))
	}

	deviceRepo := postgres.NewDeviceRepository(pool)
	positionRepo := postgres.NewPositionRepository(pool)

	// Create TCP listener
	addr := fmt.Sprintf("%s:%d", cfg.Ingest.Host, cfg.Ingest.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Fatal("failed to start TCP listener", zap.Error(err), zap.String("addr", addr))
	}
	defer listener.Close()

	logger.Info("rudra-ingest listening for GPS devices", zap.String("addr", addr))

	teltonikaCodec := codec.NewTeltonikaCodec()

	var wg sync.WaitGroup

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
				handleDeviceConnection(ctx, conn, teltonikaCodec, deviceRepo, positionRepo, pool, logger)
			}()
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down ingest server...")
	cancel()
	listener.Close()
	wg.Wait()
	logger.Info("ingest server stopped")
}

// handleDeviceConnection manages the lifecycle of a single GPS device TCP
// connection: IMEI handshake, AVL decode, database persistence, ACK.
func handleDeviceConnection(
	ctx context.Context,
	conn net.Conn,
	c *codec.TeltonikaCodec,
	deviceRepo *postgres.DeviceRepository,
	positionRepo *postgres.PositionRepository,
	pool *pgxpool.Pool,
	logger *zap.Logger,
) {
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
		_, _ = conn.Write(codec.IMEIReject())
		return
	}

	// Step 2: Resolve the device in the database. Unknown hardware is rejected;
	// the registry is authoritative.
	device, err := deviceRepo.GetByIMEI(ctx, imei)
	if err != nil || device == nil {
		logger.Warn("unknown device IMEI rejected", zap.String("imei", imei), zap.String("remote", remoteAddr))
		_, _ = conn.Write(codec.IMEIReject())
		return
	}

	deviceID := device.ID
	logger.Info("device identified", zap.String("imei", imei), zap.Int64("device_id", deviceID), zap.String("remote", remoteAddr))

	if _, err := conn.Write(codec.IMEIAccept()); err != nil {
		logger.Error("failed to send IMEI accept", zap.Error(err))
		return
	}
	_, _ = pool.Exec(ctx, "UPDATE devices SET last_heartbeat = NOW() WHERE id = $1", deviceID)

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

		positions, err := c.ParseData(dataBuf[:n], deviceID)
		if err != nil {
			logger.Error("failed to parse data", zap.Error(err), zap.String("imei", imei))
			continue
		}

		// Step 4: Persist every decoded record and acknowledge the record count.
		for i := range positions {
			pos := positions[i]
			if pos.Time.IsZero() {
				pos.Time = time.Now().UTC()
			}
			if err := positionRepo.Insert(ctx, &pos); err != nil {
				logger.Error("failed to store position", zap.Error(err), zap.Int64("device_id", deviceID))
				continue
			}
			if pos.Odometer > 0 {
				_, _ = pool.Exec(ctx, `
					UPDATE vehicles SET odometer = GREATEST(COALESCE(odometer, 0), $1), updated_at = NOW()
					WHERE device_id = $2
				`, pos.Odometer, deviceID)
			}
		}
		_, _ = pool.Exec(ctx, "UPDATE devices SET last_heartbeat = NOW() WHERE id = $1", deviceID)

		if _, err := conn.Write(c.Acknowledge(len(positions))); err != nil {
			logger.Error("failed to send acknowledgement", zap.Error(err), zap.String("imei", imei))
			return
		}

		logger.Debug("stored positions",
			zap.String("imei", imei),
			zap.Int64("device_id", deviceID),
			zap.Int("count", len(positions)),
		)
	}
}
