package service

import (
	"context"
	"time"

	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	"github.com/rudra-netra/backend/internal/repository/redis"
	ws "github.com/rudra-netra/backend/internal/websocket"
	"go.uber.org/zap"
)

// TrackingService orchestrates GPS position storage, caching, and real-time streaming.
type TrackingService struct {
	posRepo *postgres.PositionRepository
	redis   *redis.Client
	hub     *ws.Hub
	logger  *zap.Logger
}

// NewTrackingService creates a new TrackingService.
func NewTrackingService(posRepo *postgres.PositionRepository, redis *redis.Client, hub *ws.Hub, logger *zap.Logger) *TrackingService {
	return &TrackingService{
		posRepo: posRepo,
		redis:   redis,
		hub:     hub,
		logger:  logger,
	}
}

// ProcessIncomingPosition persists a newly received GPS position, caches it, and broadcasts it to WebSocket clients.
func (s *TrackingService) ProcessIncomingPosition(ctx context.Context, pos *domain.Position, companyID int64, regNumber string) error {
	// 1. Write to TimescaleDB hypertable
	if err := s.posRepo.Insert(ctx, pos); err != nil {
		s.logger.Error("failed to persist position", zap.Error(err), zap.Int64("device_id", pos.DeviceID))
		return err
	}

	livePos := &domain.LivePosition{
		Position:  *pos,
		RegNumber: regNumber,
		Status:    determineStatus(pos),
	}

	// 2. Cache latest in Redis (best-effort)
	if s.redis != nil {
		_ = s.redis.SetLivePosition(ctx, pos.DeviceID, livePos)
	}

	// 3. Broadcast to connected frontend clients via WebSocket hub
	if s.hub != nil {
		s.hub.BroadcastPosition(companyID, pos.DeviceID, livePos)
	}

	return nil
}

// GetPlaybackHistory retrieves history track points for a device between start and end times.
func (s *TrackingService) GetPlaybackHistory(ctx context.Context, deviceID int64, start, end time.Time) ([]domain.TrackPoint, error) {
	return s.posRepo.GetHistory(ctx, deviceID, start, end)
}

// GetTotalDistance retrieves total distance traveled by a device between two dates.
func (s *TrackingService) GetTotalDistance(ctx context.Context, deviceID int64, start, end time.Time) (float64, error) {
	return s.posRepo.GetTotalDistanceKM(ctx, deviceID, start, end)
}

func determineStatus(pos *domain.Position) string {
	if !pos.Ignition {
		return "stopped"
	}
	if pos.Speed > 2.0 {
		return "moving"
	}
	return "idle"
}
