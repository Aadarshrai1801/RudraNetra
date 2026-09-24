package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// PositionRepository handles TimescaleDB position queries and inserts.
type PositionRepository struct {
	pool *pgxpool.Pool
}

// NewPositionRepository creates a new PositionRepository.
func NewPositionRepository(pool *pgxpool.Pool) *PositionRepository {
	return &PositionRepository{pool: pool}
}

// Insert writes a single GPS position into the TimescaleDB hypertable.
func (r *PositionRepository) Insert(ctx context.Context, pos *domain.Position) error {
	query := `
		INSERT INTO positions (
			time, device_id, location, speed, heading, altitude,
			satellites, ignition, gsm_signal, voltage, temperature,
			odometer, rfid_tag, raw_data
		) VALUES (
			$1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15
		)
	`
	_, err := r.pool.Exec(
		ctx,
		query,
		pos.Time,
		pos.DeviceID,
		pos.Longitude,
		pos.Latitude,
		pos.Speed,
		pos.Heading,
		pos.Altitude,
		pos.Satellites,
		pos.Ignition,
		pos.GSMSignal,
		pos.Voltage,
		pos.Temperature,
		pos.Odometer,
		pos.RFIDTag,
		pos.RawData,
	)
	if err != nil {
		return fmt.Errorf("failed to insert position: %w", err)
	}
	return nil
}

// GetLatestByDevice returns the most recent position for a given device.
func (r *PositionRepository) GetLatestByDevice(ctx context.Context, deviceID int64) (*domain.Position, error) {
	query := `
		SELECT 
			time, device_id, ST_Y(location) as lat, ST_X(location) as lng,
			speed, heading, altitude, satellites, ignition, gsm_signal,
			voltage, temperature, odometer, COALESCE(rfid_tag, ''), raw_data
		FROM positions
		WHERE device_id = $1
		ORDER BY time DESC
		LIMIT 1
	`
	var pos domain.Position
	err := r.pool.QueryRow(ctx, query, deviceID).Scan(
		&pos.Time,
		&pos.DeviceID,
		&pos.Latitude,
		&pos.Longitude,
		&pos.Speed,
		&pos.Heading,
		&pos.Altitude,
		&pos.Satellites,
		&pos.Ignition,
		&pos.GSMSignal,
		&pos.Voltage,
		&pos.Temperature,
		&pos.Odometer,
		&pos.RFIDTag,
		&pos.RawData,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest position: %w", err)
	}
	return &pos, nil
}

// GetHistory returns track points for historical route playback within a time window.
func (r *PositionRepository) GetHistory(ctx context.Context, deviceID int64, start, end time.Time) ([]domain.TrackPoint, error) {
	query := `
		SELECT 
			ST_Y(location) as lat, ST_X(location) as lng,
			speed, heading, ignition, time
		FROM positions
		WHERE device_id = $1 AND time >= $2 AND time <= $3
		ORDER BY time ASC
	`
	rows, err := r.pool.Query(ctx, query, deviceID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query position history: %w", err)
	}
	defer rows.Close()

	var points []domain.TrackPoint
	for rows.Next() {
		var p domain.TrackPoint
		if err := rows.Scan(&p.Lat, &p.Lng, &p.Speed, &p.Heading, &p.Ignition, &p.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan track point: %w", err)
		}
		points = append(points, p)
	}
	return points, nil
}

// GetTotalDistanceKM computes the total distance traveled using PostGIS ST_Length.
func (r *PositionRepository) GetTotalDistanceKM(ctx context.Context, deviceID int64, start, end time.Time) (float64, error) {
	query := `
		SELECT COALESCE(ST_Length(ST_MakeLine(location ORDER BY time)::geography) / 1000.0, 0)
		FROM positions
		WHERE device_id = $1 AND time >= $2 AND time <= $3
	`
	var dist float64
	err := r.pool.QueryRow(ctx, query, deviceID, start, end).Scan(&dist)
	if err != nil {
		return 0, fmt.Errorf("failed to compute distance: %w", err)
	}
	return dist, nil
}
