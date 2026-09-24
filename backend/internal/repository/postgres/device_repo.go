package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// DeviceRepository provides PostgreSQL persistence for Device entities.
type DeviceRepository struct {
	pool *pgxpool.Pool
}

// NewDeviceRepository creates a new DeviceRepository.
func NewDeviceRepository(pool *pgxpool.Pool) *DeviceRepository {
	return &DeviceRepository{pool: pool}
}

// GetByID finds a device by primary key.
func (r *DeviceRepository) GetByID(ctx context.Context, id int64) (*domain.Device, error) {
	query := `
		SELECT id, COALESCE(company_id, 0), imei, COALESCE(device_type, ''), COALESCE(sim_no, ''), COALESCE(port, 5040), COALESCE(status, 'active'), warranty_end, created_at
		FROM devices
		WHERE id = $1
	`
	var d domain.Device
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&d.ID,
		&d.CompanyID,
		&d.IMEI,
		&d.DeviceType,
		&d.SimNo,
		&d.Port,
		&d.Status,
		&d.WarrantyEnd,
		&d.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}
	return &d, nil
}

// GetByIMEI finds a device by its unique IMEI.
func (r *DeviceRepository) GetByIMEI(ctx context.Context, imei string) (*domain.Device, error) {
	query := `
		SELECT id, COALESCE(company_id, 0), imei, COALESCE(device_type, ''), COALESCE(sim_no, ''), COALESCE(port, 5040), COALESCE(status, 'active'), warranty_end, created_at
		FROM devices
		WHERE imei = $1
	`
	var d domain.Device
	err := r.pool.QueryRow(ctx, query, imei).Scan(
		&d.ID,
		&d.CompanyID,
		&d.IMEI,
		&d.DeviceType,
		&d.SimNo,
		&d.Port,
		&d.Status,
		&d.WarrantyEnd,
		&d.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("device with IMEI %s not found: %w", imei, err)
	}
	return &d, nil
}

// ListByCompany lists all devices for a given company with pagination.
func (r *DeviceRepository) ListByCompany(ctx context.Context, filter domain.DeviceFilter) ([]domain.Device, int64, error) {
	offset := (filter.Page - 1) * filter.PageSize
	if offset < 0 {
		offset = 0
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 50
	}

	countQuery := `SELECT COUNT(*) FROM devices WHERE company_id = $1`
	var total int64
	if err := r.pool.QueryRow(ctx, countQuery, filter.CompanyID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count devices: %w", err)
	}

	query := `
		SELECT id, COALESCE(company_id, 0), imei, COALESCE(device_type, ''), COALESCE(sim_no, ''), COALESCE(port, 5040), COALESCE(status, 'active'), warranty_end, created_at
		FROM devices
		WHERE company_id = $1
		ORDER BY id DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.pool.Query(ctx, query, filter.CompanyID, filter.PageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list devices: %w", err)
	}
	defer rows.Close()

	var devices []domain.Device
	for rows.Next() {
		var d domain.Device
		if err := rows.Scan(
			&d.ID,
			&d.CompanyID,
			&d.IMEI,
			&d.DeviceType,
			&d.SimNo,
			&d.Port,
			&d.Status,
			&d.WarrantyEnd,
			&d.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan device: %w", err)
		}
		devices = append(devices, d)
	}

	return devices, total, nil
}

// Create inserts a new device record.
func (r *DeviceRepository) Create(ctx context.Context, d *domain.Device) error {
	query := `
		INSERT INTO devices (company_id, imei, device_type, sim_no, port, status, warranty_end)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	return r.pool.QueryRow(
		ctx,
		query,
		d.CompanyID,
		d.IMEI,
		d.DeviceType,
		d.SimNo,
		d.Port,
		d.Status,
		d.WarrantyEnd,
	).Scan(&d.ID, &d.CreatedAt)
}
