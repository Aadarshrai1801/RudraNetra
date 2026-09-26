// rudra-ingest is the TCP server that accepts connections from GPS devices
// (Teltonika), decodes Codec 8 / Codec 8 Extended AVL frames, persists them to
// PostgreSQL/TimescaleDB, publishes live positions on Redis, and delivers
// Codec 12 GPRS commands to connected devices.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/codec"
	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/events"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	redisrepo "github.com/rudra-netra/backend/internal/repository/redis"
)

const readBufferSize = 64 * 1024

// ingestStats tracks socket-tier counters exposed on the metrics endpoint.
type ingestStats struct {
	activeConns      atomic.Int64
	totalConns       atomic.Int64
	frames           atomic.Int64
	records          atomic.Int64
	crcMismatches    atomic.Int64
	resyncs          atomic.Int64
	unsupportedCodec atomic.Int64
	parseErrors      atomic.Int64
	batchErrors      atomic.Int64
	positionsStored  atomic.Int64
	publishErrors    atomic.Int64
	commandsSent     atomic.Int64
	commandsAcked    atomic.Int64
	lastPacketUnix   atomic.Int64
}

var stats ingestStats

var ingestStartedAt = time.Now()

// deviceSession is an active device TCP connection.
type deviceSession struct {
	conn        net.Conn
	imei        string
	deviceID    int64
	companyID   int64
	regNumber   string
	lastCommand atomic.Int64 // device_commands.id awaiting a Codec 12 response
}

var sessions sync.Map // imei -> *deviceSession

// commandMessage is published by the API when an operator issues a command.
type commandMessage struct {
	IMEI      string `json:"imei"`
	CommandID int64  `json:"command_id"`
	Command   string `json:"command"`
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load("")
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Database is the source of truth: device registry and position storage.
	pool, err := pgxpool.New(ctx, cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to create database pool", zap.Error(err))
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		logger.Fatal("database is unreachable", zap.Error(err))
	}

	// Redis carries live positions to the API and commands to devices.
	// It is optional: without it ingestion still persists to the database.
	redisClient, err := redisrepo.NewClient(ctx, &cfg.Redis, logger)
	if err != nil {
		logger.Warn("redis unavailable - live streaming and remote commands are disabled", zap.Error(err))
		redisClient = nil
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	deviceRepo := postgres.NewDeviceRepository(pool)
	positionRepo := postgres.NewPositionRepository(pool)

	// Metrics / health endpoint (TCP 5041 by default)
	go serveStats(fmt.Sprintf(":%d", cfg.Ingest.MetricsPort), logger)

	// Deliver commands published by the API to connected devices.
	go subscribeCommands(ctx, redisClient, pool, logger)

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
				handleDeviceConnection(ctx, conn, teltonikaCodec, deviceRepo, positionRepo, pool, redisClient, logger)
			}()
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down ingest server...")
	cancel()
	listener.Close()

	// Close established device connections so the read loops unblock.
	sessions.Range(func(_, value interface{}) bool {
		if sess, ok := value.(*deviceSession); ok {
			_ = sess.conn.Close()
		}
		return true
	})

	wg.Wait()
	logger.Info("ingest server stopped")
}

// handleDeviceConnection manages the lifecycle of a single GPS device TCP
// connection: IMEI handshake, frame reassembly, persistence, ACK and the
// Codec 12 command channel.
func handleDeviceConnection(
	ctx context.Context,
	conn net.Conn,
	c *codec.TeltonikaCodec,
	deviceRepo *postgres.DeviceRepository,
	positionRepo *postgres.PositionRepository,
	pool *pgxpool.Pool,
	redisClient *redisrepo.Client,
	logger *zap.Logger,
) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()
	stats.activeConns.Add(1)
	stats.totalConns.Add(1)
	defer stats.activeConns.Add(-1)

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

	// Step 2: Resolve the device in the database. Unknown hardware is rejected.
	device, err := deviceRepo.GetByIMEI(ctx, imei)
	if err != nil || device == nil {
		logger.Warn("unknown device IMEI rejected", zap.String("imei", imei), zap.String("remote", remoteAddr))
		_, _ = conn.Write(codec.IMEIReject())
		return
	}

	deviceID := device.ID
	companyID, regNumber := lookupDeviceContext(ctx, pool, deviceID)

	sess := &deviceSession{
		conn:      conn,
		imei:      imei,
		deviceID:  deviceID,
		companyID: companyID,
		regNumber: regNumber,
	}
	sessions.Store(imei, sess)
	defer sessions.Delete(imei)

	logger.Info("device identified",
		zap.String("imei", imei),
		zap.Int64("device_id", deviceID),
		zap.Int64("company_id", companyID),
		zap.String("reg_number", regNumber),
		zap.String("remote", remoteAddr))

	if _, err := conn.Write(codec.IMEIAccept()); err != nil {
		logger.Error("failed to send IMEI accept", zap.Error(err))
		return
	}
	_, _ = pool.Exec(ctx, "UPDATE devices SET last_heartbeat = NOW() WHERE id = $1", deviceID)

	// Step 3: Read frames until the device disconnects.
	framer := codec.NewStreamFramer()
	readBuf := make([]byte, readBufferSize)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		n, err := conn.Read(readBuf)
		if err != nil {
			if err != io.EOF {
				logger.Info("device disconnected", zap.String("imei", imei), zap.Error(err))
			} else {
				logger.Info("device disconnected", zap.String("imei", imei))
			}
			return
		}
		if n == 0 {
			continue
		}

		stats.lastPacketUnix.Store(time.Now().Unix())
		framer.Append(readBuf[:n])

		for {
			frame, ok, frameErr := framer.Next()
			if frameErr != nil {
				stats.resyncs.Add(1)
				logger.Debug("stream resynchronised", zap.String("imei", imei), zap.Error(frameErr))
			}
			if !ok {
				break
			}
			stats.frames.Add(1)

			if !isZeroCRC(frame.CRC) && !frame.CRCValid() {
				stats.crcMismatches.Add(1)
				logger.Warn("AVL frame CRC mismatch", zap.String("imei", imei))
			}

			switch frame.Payload[0] {
			case codec.CODEC12:
				handleCommandResponse(ctx, pool, sess, frame.Payload, logger)
			case codec.CODEC8, codec.CODEC8E:
				handleAVLFrame(ctx, conn, sess, c, positionRepo, pool, redisClient, frame.Payload, logger)
			default:
				stats.unsupportedCodec.Add(1)
				logger.Warn("unsupported codec id", zap.String("imei", imei), zap.Uint8("codec", frame.Payload[0]))
			}
		}
	}
}

// handleAVLFrame decodes, stores and acknowledges one AVL data frame.
func handleAVLFrame(
	ctx context.Context,
	conn net.Conn,
	sess *deviceSession,
	c *codec.TeltonikaCodec,
	positionRepo *postgres.PositionRepository,
	pool *pgxpool.Pool,
	redisClient *redisrepo.Client,
	payload []byte,
	logger *zap.Logger,
) {
	positions, err := c.ParseFrame(payload, sess.deviceID)
	if err != nil {
		stats.parseErrors.Add(1)
		logger.Error("failed to parse AVL frame", zap.String("imei", sess.imei), zap.Error(err))
		return
	}

	// Normalise timestamps before the batch write.
	for i := range positions {
		if positions[i].Time.IsZero() {
			positions[i].Time = time.Now().UTC()
		}
	}

	stored, err := positionRepo.InsertBatch(ctx, positions)
	if err != nil {
		stats.batchErrors.Add(1)
		logger.Error("failed to store position batch",
			zap.Error(err), zap.String("imei", sess.imei), zap.Int("records", len(positions)))
	}
	stats.records.Add(int64(len(positions)))
	stats.positionsStored.Add(int64(stored))

	if stored > 0 {
		for i := range positions {
			pos := &positions[i]
			if pos.Odometer > 0 {
				_, _ = pool.Exec(ctx, `
					UPDATE vehicles SET odometer = GREATEST(COALESCE(odometer, 0), $1), updated_at = NOW()
					WHERE device_id = $2
				`, pos.Odometer, sess.deviceID)
			}

			publishPosition(ctx, redisClient, sess, pos, logger)
		}
	}

	_, _ = pool.Exec(ctx, "UPDATE devices SET last_heartbeat = NOW() WHERE id = $1", sess.deviceID)

	// Acknowledge the number of records accepted into the database.
	if _, err := conn.Write(c.Acknowledge(stored)); err != nil {
		logger.Error("failed to send acknowledgement", zap.Error(err), zap.String("imei", sess.imei))
		return
	}

	logger.Debug("AVL frame processed",
		zap.String("imei", sess.imei),
		zap.Int("records", len(positions)),
		zap.Int("stored", stored))
}

// publishPosition pushes a live event to Redis for the API's WebSocket hub.
func publishPosition(ctx context.Context, redisClient *redisrepo.Client, sess *deviceSession, pos *domain.Position, logger *zap.Logger) {
	if redisClient == nil {
		return
	}

	event := domain.LiveEvent{
		CompanyID: sess.companyID,
		DeviceID:  sess.deviceID,
		RegNumber: sess.regNumber,
		Lat:       pos.Latitude,
		Lng:       pos.Longitude,
		Speed:     float64(pos.Speed),
		Heading:   float64(pos.Heading),
		Ignition:  pos.Ignition,
		Status:    positionStatus(pos),
		Odometer:  pos.Odometer,
		Timestamp: pos.Time.UTC().Format(time.RFC3339),
	}
	if pos.Temperature != 0 {
		t := float64(pos.Temperature)
		event.Temperature = &t
	}
	if pos.Voltage != 0 {
		v := float64(pos.Voltage)
		event.Voltage = &v
	}
	event.FuelPct = pos.FuelLevelPct
	event.BatteryV = pos.BackupBatteryV
	event.DoorOpen = pos.DoorOpen

	pubCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := redisClient.Publish(pubCtx, events.PositionsChannel, event); err != nil {
		stats.publishErrors.Add(1)
		logger.Debug("failed to publish live position", zap.Error(err), zap.String("imei", sess.imei))
	}
}

// handleCommandResponse records a Codec 12 response against the last command
// delivered to this device.
func handleCommandResponse(ctx context.Context, pool *pgxpool.Pool, sess *deviceSession, payload []byte, logger *zap.Logger) {
	responses, err := codec.ParseCommandPayload(payload)
	if err != nil {
		logger.Warn("failed to parse command response", zap.String("imei", sess.imei), zap.Error(err))
		return
	}
	if len(responses) == 0 {
		return
	}

	text := responses[0]
	if len(responses) > 1 {
		encoded, _ := json.Marshal(responses)
		text = string(encoded)
	}

	commandID := sess.lastCommand.Load()
	if commandID > 0 {
		_, _ = pool.Exec(ctx, `
			UPDATE device_commands
			SET status = 'Acknowledged', ack_at = NOW(), response = $1
			WHERE id = $2
		`, text, commandID)
		sess.lastCommand.Store(0)
		stats.commandsAcked.Add(1)
	}

	logger.Info("device command response",
		zap.String("imei", sess.imei),
		zap.Int64("command_id", commandID),
		zap.String("response", text))
}

// subscribeCommands listens for commands published by the API and writes them
// to the matching device socket as Codec 12 frames.
func subscribeCommands(ctx context.Context, redisClient *redisrepo.Client, pool *pgxpool.Pool, logger *zap.Logger) {
	if redisClient == nil {
		return
	}

	pubsub := redisClient.Subscribe(ctx, events.CommandsChannel)
	defer pubsub.Close()
	channel := pubsub.Channel()

	logger.Info("subscribed to device command channel", zap.String("channel", events.CommandsChannel))

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-channel:
			if !ok {
				return
			}
			var cmd commandMessage
			if err := json.Unmarshal([]byte(msg.Payload), &cmd); err != nil {
				logger.Warn("invalid command payload", zap.Error(err))
				continue
			}

			value, ok := sessions.Load(cmd.IMEI)
			if !ok {
				logger.Info("command queued for offline device", zap.String("imei", cmd.IMEI), zap.Int64("command_id", cmd.CommandID))
				continue
			}
			sess := value.(*deviceSession)

			if _, err := sess.conn.Write(codec.BuildCommandFrame(cmd.Command)); err != nil {
				logger.Warn("failed to deliver command", zap.String("imei", cmd.IMEI), zap.Error(err))
				continue
			}

			sess.lastCommand.Store(cmd.CommandID)
			_, _ = pool.Exec(ctx, `
				UPDATE device_commands SET status = 'Delivered', delivered_at = NOW()
				WHERE id = $1 AND status = 'Sent'
			`, cmd.CommandID)
			stats.commandsSent.Add(1)
			logger.Info("command delivered to device",
				zap.String("imei", cmd.IMEI),
				zap.Int64("command_id", cmd.CommandID),
				zap.String("command", cmd.Command))
		}
	}
}

// lookupDeviceContext fetches the tenant and plate for a device (best effort).
func lookupDeviceContext(ctx context.Context, pool *pgxpool.Pool, deviceID int64) (int64, string) {
	var companyID int64
	var regNumber string
	_ = pool.QueryRow(ctx, `
		SELECT COALESCE(d.company_id, 0), COALESCE(v.reg_number, '')
		FROM devices d
		LEFT JOIN vehicles v ON v.device_id = d.id
		WHERE d.id = $1
	`, deviceID).Scan(&companyID, &regNumber)
	return companyID, regNumber
}

// positionStatus mirrors the API/vehicle status rules.
func positionStatus(pos *domain.Position) string {
	switch {
	case pos.Speed > 2:
		return "moving"
	case pos.Ignition:
		return "idle"
	default:
		return "stopped"
	}
}

func isZeroCRC(crc []byte) bool {
	for _, b := range crc {
		if b != 0 {
			return false
		}
	}
	return true
}

// serveStats exposes socket-tier counters for monitoring.
func serveStats(addr string, logger *zap.Logger) {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "ok",
			"service": "rudra-ingest",
			"uptime":  time.Since(ingestStartedAt).Round(time.Second).String(),
		})
	})

	mux.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		connected := 0
		sessions.Range(func(_, _ interface{}) bool {
			connected++
			return true
		})

		lastPacket := int64(0)
		if v := stats.lastPacketUnix.Load(); v > 0 {
			lastPacket = v
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"service":           "rudra-ingest",
			"uptime_seconds":    int64(time.Since(ingestStartedAt).Seconds()),
			"connected_devices": connected,
			"connections_total": stats.totalConns.Load(),
			"frames_total":      stats.frames.Load(),
			"records_total":     stats.records.Load(),
			"positions_stored":  stats.positionsStored.Load(),
			"crc_mismatches":    stats.crcMismatches.Load(),
			"stream_resyncs":    stats.resyncs.Load(),
			"unsupported_codec": stats.unsupportedCodec.Load(),
			"parse_errors":      stats.parseErrors.Load(),
			"batch_errors":      stats.batchErrors.Load(),
			"publish_errors":    stats.publishErrors.Load(),
			"commands_sent":     stats.commandsSent.Load(),
			"commands_acked":    stats.commandsAcked.Load(),
			"last_packet_unix":  lastPacket,
		})
	})

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Warn("ingest stats endpoint stopped", zap.String("addr", addr), zap.Error(err))
	}
}
