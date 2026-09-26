package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// ReportRepository queries TimescaleDB and PostGIS for telematics reports.
type ReportRepository struct {
	pool *pgxpool.Pool
}

// NewReportRepository creates a new ReportRepository.
func NewReportRepository(pool *pgxpool.Pool) *ReportRepository {
	return &ReportRepository{pool: pool}
}

// GetDistanceReport aggregates total distance, speeds, and run/idle/stop times per vehicle.
// Time buckets are computed from the real inter-record intervals in the
// positions hypertable — no sampling-rate assumptions.
func (r *ReportRepository) GetDistanceReport(ctx context.Context, companyID int64, start, end time.Time) ([]domain.DistanceReportRow, error) {
	query := `
		WITH windowed AS (
			SELECT p.device_id, p.time, p.ignition, p.speed, p.odometer, p.location,
			       LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_time
			FROM positions p
			WHERE p.time >= $2 AND p.time <= $3
		)
		SELECT 
			d.id AS device_id,
			v.reg_number,
			COALESCE(MIN(w.odometer), 0) AS start_odometer,
			COALESCE(MAX(w.odometer), 0) AS end_odometer,
			COALESCE(ROUND((ST_Length(ST_MakeLine(w.location ORDER BY w.time)::geography) / 1000.0)::numeric, 1), 0)::float8 AS distance_km,
			COALESCE(MAX(w.speed), 0)::float8 AS max_speed,
			COALESCE(ROUND(AVG(w.speed)::numeric, 1), 0)::float8 AS avg_speed,
			COALESCE(SUM(EXTRACT(EPOCH FROM (w.time - w.prev_time)) / 60)
				FILTER (WHERE w.prev_time IS NOT NULL AND w.ignition AND w.speed > 2), 0)::int AS moving_min,
			COALESCE(SUM(EXTRACT(EPOCH FROM (w.time - w.prev_time)) / 60)
				FILTER (WHERE w.prev_time IS NOT NULL AND w.ignition AND w.speed <= 2), 0)::int AS idle_min,
			COALESCE(SUM(EXTRACT(EPOCH FROM (w.time - w.prev_time)) / 60)
				FILTER (WHERE w.prev_time IS NOT NULL AND NOT w.ignition), 0)::int AS stop_min
		FROM devices d
		JOIN vehicles v ON v.device_id = d.id
		LEFT JOIN windowed w ON w.device_id = d.id
		WHERE d.company_id = $1
		GROUP BY d.id, v.reg_number
		ORDER BY v.reg_number ASC
	`
	rows, err := r.pool.Query(ctx, query, companyID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query distance report: %w", err)
	}
	defer rows.Close()

	var reportRows []domain.DistanceReportRow
	for rows.Next() {
		var row domain.DistanceReportRow
		if err := rows.Scan(
			&row.DeviceID,
			&row.RegNumber,
			&row.StartOdometer,
			&row.EndOdometer,
			&row.DistanceKM,
			&row.MaxSpeed,
			&row.AvgSpeed,
			&row.MovingTimeMin,
			&row.IdleTimeMin,
			&row.StopTimeMin,
		); err != nil {
			return nil, fmt.Errorf("failed to scan distance row: %w", err)
		}
		reportRows = append(reportRows, row)
	}
	return reportRows, nil
}

// GetSpeedViolations finds all occurrences where vehicle speed exceeded the
// vehicle limit (falling back to the tenant threshold supplied by the caller).
func (r *ReportRepository) GetSpeedViolations(ctx context.Context, companyID int64, start, end time.Time, threshold float32) ([]domain.SpeedViolationRow, error) {
	query := `
		SELECT 
			d.id,
			v.reg_number,
			p.time,
			p.speed,
			COALESCE(NULLIF(v.max_speed, 0), $4) AS speed_limit,
			(p.speed - COALESCE(NULLIF(v.max_speed, 0), $4)) AS exceeded_by,
			ST_Y(p.location) AS lat,
			ST_X(p.location) AS lng
		FROM positions p
		JOIN devices d ON d.id = p.device_id
		JOIN vehicles v ON v.device_id = d.id
		WHERE d.company_id = $1
		  AND p.time >= $2 AND p.time <= $3
		  AND p.speed > COALESCE(NULLIF(v.max_speed, 0), $4)
		ORDER BY p.time DESC
		LIMIT 200
	`
	rows, err := r.pool.Query(ctx, query, companyID, start, end, threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to query speed violations: %w", err)
	}
	defer rows.Close()

	var violations []domain.SpeedViolationRow
	for rows.Next() {
		var v domain.SpeedViolationRow
		var t time.Time
		if err := rows.Scan(
			&v.DeviceID,
			&v.RegNumber,
			&t,
			&v.Speed,
			&v.SpeedLimit,
			&v.ExceededBy,
			&v.Latitude,
			&v.Longitude,
		); err != nil {
			return nil, fmt.Errorf("failed to scan speed violation row: %w", err)
		}
		v.Time = t.Format(time.RFC3339)
		violations = append(violations, v)
	}
	return violations, nil
}
