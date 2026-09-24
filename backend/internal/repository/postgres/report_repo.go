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
func (r *ReportRepository) GetDistanceReport(ctx context.Context, companyID int64, start, end time.Time) ([]domain.DistanceReportRow, error) {
	query := `
		SELECT 
			d.id AS device_id,
			v.reg_number,
			COALESCE(MIN(p.odometer), 0) AS start_odometer,
			COALESCE(MAX(p.odometer), 0) AS end_odometer,
			COALESCE(ST_Length(ST_MakeLine(p.location ORDER BY p.time)::geography) / 1000.0, 0) AS distance_km,
			COALESCE(MAX(p.speed), 0) AS max_speed,
			COALESCE(AVG(p.speed), 0) AS avg_speed,
			COUNT(CASE WHEN p.ignition = true AND p.speed > 2 THEN 1 END) AS moving_points,
			COUNT(CASE WHEN p.ignition = true AND p.speed <= 2 THEN 1 END) AS idle_points,
			COUNT(CASE WHEN p.ignition = false THEN 1 END) AS stop_points
		FROM devices d
		JOIN vehicles v ON v.device_id = d.id
		LEFT JOIN positions p ON p.device_id = d.id AND p.time >= $2 AND p.time <= $3
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
		var movingPts, idlePts, stopPts int
		if err := rows.Scan(
			&row.DeviceID,
			&row.RegNumber,
			&row.StartOdometer,
			&row.EndOdometer,
			&row.DistanceKM,
			&row.MaxSpeed,
			&row.AvgSpeed,
			&movingPts,
			&idlePts,
			&stopPts,
		); err != nil {
			return nil, fmt.Errorf("failed to scan distance row: %w", err)
		}

		// Estimate minutes assuming typical 30-second ping interval
		row.MovingTimeMin = (movingPts * 30) / 60
		row.IdleTimeMin = (idlePts * 30) / 60
		row.StopTimeMin = (stopPts * 30) / 60

		reportRows = append(reportRows, row)
	}
	return reportRows, nil
}

// GetSpeedViolations finds all occurrences where vehicle speed exceeded maximum threshold.
func (r *ReportRepository) GetSpeedViolations(ctx context.Context, companyID int64, start, end time.Time, threshold float32) ([]domain.SpeedViolationRow, error) {
	query := `
		SELECT 
			d.id,
			v.reg_number,
			p.time,
			p.speed,
			COALESCE(v.max_speed, 80) AS speed_limit,
			(p.speed - COALESCE(v.max_speed, 80)) AS exceeded_by,
			ST_Y(p.location) AS lat,
			ST_X(p.location) AS lng
		FROM positions p
		JOIN devices d ON d.id = p.device_id
		JOIN vehicles v ON v.device_id = d.id
		WHERE d.company_id = $1
		  AND p.time >= $2 AND p.time <= $3
		  AND p.speed > COALESCE(v.max_speed, $4)
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
