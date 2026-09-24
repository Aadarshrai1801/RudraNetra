package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// GeofenceRepository manages geofences and spatial containment queries.
type GeofenceRepository struct {
	pool *pgxpool.Pool
}

// NewGeofenceRepository creates a new GeofenceRepository.
func NewGeofenceRepository(pool *pgxpool.Pool) *GeofenceRepository {
	return &GeofenceRepository{pool: pool}
}

// CheckContainment returns all geofences containing the given point (lon, lat).
func (r *GeofenceRepository) CheckContainment(ctx context.Context, companyID int64, lon, lat float64) ([]domain.GeofenceCheckResult, error) {
	query := `
		SELECT id, name
		FROM geofences
		WHERE company_id = $1 
		  AND is_active = true 
		  AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))
	`
	rows, err := r.pool.Query(ctx, query, companyID, lon, lat)
	if err != nil {
		return nil, fmt.Errorf("failed to check geofence containment: %w", err)
	}
	defer rows.Close()

	var results []domain.GeofenceCheckResult
	for rows.Next() {
		var res domain.GeofenceCheckResult
		if err := rows.Scan(&res.GeofenceID, &res.GeofenceName); err != nil {
			return nil, fmt.Errorf("failed to scan geofence result: %w", err)
		}
		res.IsInside = true
		results = append(results, res)
	}
	return results, nil
}

// FindNearestPOI finds POIs within a given radius (meters) using ST_DWithin on geography.
func (r *GeofenceRepository) FindNearestPOI(ctx context.Context, companyID int64, req domain.NearestPOIRequest) ([]domain.NearestPOIResult, error) {
	query := `
		SELECT 
			id, company_id, name, ST_Y(location) as lat, ST_X(location) as lng,
			COALESCE(category, ''), COALESCE(address, ''), created_at,
			ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS distance_m
		FROM poi
		WHERE company_id = $1
		  AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
		ORDER BY distance_m ASC
		LIMIT $5
	`
	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.pool.Query(ctx, query, companyID, req.Longitude, req.Latitude, req.RadiusM, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query nearest POI: %w", err)
	}
	defer rows.Close()

	var results []domain.NearestPOIResult
	for rows.Next() {
		var item domain.NearestPOIResult
		if err := rows.Scan(
			&item.ID,
			&item.CompanyID,
			&item.Name,
			&item.Latitude,
			&item.Longitude,
			&item.Category,
			&item.Address,
			&item.CreatedAt,
			&item.DistanceM,
		); err != nil {
			return nil, fmt.Errorf("failed to scan POI result: %w", err)
		}
		results = append(results, item)
	}
	return results, nil
}
