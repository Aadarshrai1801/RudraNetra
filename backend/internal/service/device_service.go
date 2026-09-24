package service

import (
	"context"

	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/repository/postgres"
)

// DeviceService manages business rules for GPS devices.
type DeviceService struct {
	deviceRepo *postgres.DeviceRepository
}

// NewDeviceService creates a new DeviceService.
func NewDeviceService(deviceRepo *postgres.DeviceRepository) *DeviceService {
	return &DeviceService{deviceRepo: deviceRepo}
}

// GetByID finds a device by ID.
func (s *DeviceService) GetByID(ctx context.Context, id int64) (*domain.Device, error) {
	return s.deviceRepo.GetByID(ctx, id)
}

// GetByIMEI finds a device by IMEI.
func (s *DeviceService) GetByIMEI(ctx context.Context, imei string) (*domain.Device, error) {
	return s.deviceRepo.GetByIMEI(ctx, imei)
}

// ListByCompany lists paginated devices for a company.
func (s *DeviceService) ListByCompany(ctx context.Context, filter domain.DeviceFilter) ([]domain.Device, int64, error) {
	return s.deviceRepo.ListByCompany(ctx, filter)
}

// RegisterDevice registers a new device.
func (s *DeviceService) RegisterDevice(ctx context.Context, device *domain.Device) error {
	return s.deviceRepo.Create(ctx, device)
}
