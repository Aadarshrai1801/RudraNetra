package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// VehicleRepository handles database operations for vehicles.
type VehicleRepository struct {
	pool *pgxpool.Pool
}

// NewVehicleRepository creates a new VehicleRepository.
func NewVehicleRepository(pool *pgxpool.Pool) *VehicleRepository {
	return &VehicleRepository{pool: pool}
}

// ListByCompany returns vehicles belonging to a specific company, including their latest telemetry.
func (r *VehicleRepository) ListByCompany(ctx context.Context, companyID int64, limit, offset int) ([]domain.VehicleWithTelemetry, error) {
	if limit <= 0 || limit > 1000 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			v.id,
			v.company_id,
			v.device_id,
			v.reg_number,
			COALESCE(v.make, ''),
			COALESCE(v.model, ''),
			COALESCE(v.variant, ''),
			COALESCE(v.body_type, ''),
			COALESCE(v.fuel_type, 'Diesel'),
			COALESCE(v.max_speed, 80),
			COALESCE(v.odometer, 0),
			COALESCE(v.icon_type, 'truck'),
			COALESCE(d.name, ''),
			COALESCE(d.phone, ''),
			p.lat,
			p.lng,
			p.speed,
			p.heading,
			p.ignition,
			p.temperature,
			p.time
		FROM vehicles v
		LEFT JOIN drivers d ON d.assigned_vehicle_id = v.id
		LEFT JOIN LATERAL (
			SELECT 
				ST_Y(location) as lat, 
				ST_X(location) as lng, 
				speed, 
				heading, 
				ignition, 
				temperature,
				time 
			FROM positions 
			WHERE device_id = v.device_id 
			ORDER BY time DESC 
			LIMIT 1
		) p ON true
		WHERE v.company_id = $1
		ORDER BY v.id ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, companyID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicles for company %d: %w", companyID, err)
	}
	defer rows.Close()

	var vehicles []domain.VehicleWithTelemetry
	for rows.Next() {
		var v domain.VehicleWithTelemetry
		var (
			lat         *float64
			lng         *float64
			speed       *float64
			heading     *float64
			ignition    *bool
			temperature *float64
			posTime     *time.Time
		)

		if err := rows.Scan(
			&v.ID,
			&v.CompanyID,
			&v.DeviceID,
			&v.RegNumber,
			&v.Make,
			&v.Model,
			&v.Variant,
			&v.BodyType,
			&v.FuelType,
			&v.MaxSpeed,
			&v.Odometer,
			&v.IconType,
			&v.DriverName,
			&v.DriverPhone,
			&lat,
			&lng,
			&speed,
			&heading,
			&ignition,
			&temperature,
			&posTime,
		); err != nil {
			return nil, fmt.Errorf("failed to scan vehicle: %w", err)
		}

		v.Lat = lat
		v.Lng = lng
		v.Speed = speed
		v.Heading = heading
		v.Ignition = ignition
		v.Temperature = temperature
		v.Timestamp = posTime

		// Compute operational status
		if lat == nil || lng == nil {
			v.Status = "offline"
		} else if speed != nil && *speed > 2.0 {
			v.Status = "moving"
		} else if ignition != nil && *ignition {
			v.Status = "idle"
		} else {
			v.Status = "stopped"
		}

		// Provide readable driver fallback if none assigned
		if v.DriverName == "" {
			v.DriverName = fmt.Sprintf("Operator #%d", v.ID%100+1)
			v.DriverPhone = fmt.Sprintf("+971 50 %07d", 1000000+v.ID)
		}

		vehicles = append(vehicles, v)
	}

	return vehicles, rows.Err()
}

// CountByCompany returns the total vehicle count for an organization.
func (r *VehicleRepository) CountByCompany(ctx context.Context, companyID int64) (int64, error) {
	query := `SELECT COUNT(*) FROM vehicles WHERE company_id = $1`
	var count int64
	err := r.pool.QueryRow(ctx, query, companyID).Scan(&count)
	return count, err
}

// GetByID returns a single vehicle by ID ensuring it belongs to the given company.
func (r *VehicleRepository) GetByID(ctx context.Context, id int64, companyID int64) (*domain.VehicleWithTelemetry, error) {
	query := `
		SELECT 
			v.id,
			v.company_id,
			v.device_id,
			v.reg_number,
			COALESCE(v.make, ''),
			COALESCE(v.model, ''),
			COALESCE(v.variant, ''),
			COALESCE(v.body_type, ''),
			COALESCE(v.fuel_type, 'Diesel'),
			COALESCE(v.max_speed, 80),
			COALESCE(v.odometer, 0),
			COALESCE(v.icon_type, 'truck'),
			COALESCE(d.name, ''),
			COALESCE(d.phone, ''),
			p.lat,
			p.lng,
			p.speed,
			p.heading,
			p.ignition,
			p.temperature,
			p.time
		FROM vehicles v
		LEFT JOIN drivers d ON d.assigned_vehicle_id = v.id
		LEFT JOIN LATERAL (
			SELECT 
				ST_Y(location) as lat, 
				ST_X(location) as lng, 
				speed, 
				heading, 
				ignition, 
				temperature,
				time 
			FROM positions 
			WHERE device_id = v.device_id 
			ORDER BY time DESC 
			LIMIT 1
		) p ON true
		WHERE v.id = $1 AND v.company_id = $2
	`
	var v domain.VehicleWithTelemetry
	var (
		lat         *float64
		lng         *float64
		speed       *float64
		heading     *float64
		ignition    *bool
		temperature *float64
		posTime     *time.Time
	)

	err := r.pool.QueryRow(ctx, query, id, companyID).Scan(
		&v.ID,
		&v.CompanyID,
		&v.DeviceID,
		&v.RegNumber,
		&v.Make,
		&v.Model,
		&v.Variant,
		&v.BodyType,
		&v.FuelType,
		&v.MaxSpeed,
		&v.Odometer,
		&v.IconType,
		&v.DriverName,
		&v.DriverPhone,
		&lat,
		&lng,
		&speed,
		&heading,
		&ignition,
		&temperature,
		&posTime,
	)
	if err != nil {
		return nil, fmt.Errorf("vehicle not found: %w", err)
	}

	v.Lat = lat
	v.Lng = lng
	v.Speed = speed
	v.Heading = heading
	v.Ignition = ignition
	v.Temperature = temperature
	v.Timestamp = posTime

	if lat == nil || lng == nil {
		v.Status = "offline"
	} else if speed != nil && *speed > 2.0 {
		v.Status = "moving"
	} else if ignition != nil && *ignition {
		v.Status = "idle"
	} else {
		v.Status = "stopped"
	}

	return &v, nil
}
