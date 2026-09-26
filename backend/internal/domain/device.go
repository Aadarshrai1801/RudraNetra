package domain

import "time"

// Device represents a GPS tracking device (e.g., Teltonika FMB920).
type Device struct {
	ID          int64      `json:"id" db:"id"`
	CompanyID   int64      `json:"company_id" db:"company_id"`
	IMEI        string     `json:"imei" db:"imei"`
	DeviceType  string     `json:"device_type" db:"device_type"` // TELTONIKA_FMB920, etc.
	SimNo       string     `json:"sim_no" db:"sim_no"`
	Port        int        `json:"port" db:"port"` // TCP port
	Status      string     `json:"status" db:"status"`
	WarrantyEnd *time.Time `json:"warranty_end,omitempty" db:"warranty_end"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`

	// Joined fields (not stored directly)
	Vehicle      *Vehicle  `json:"vehicle,omitempty"`
	LastPosition *Position `json:"last_position,omitempty"`
}

// DeviceFilter holds query parameters for listing devices.
type DeviceFilter struct {
	CompanyID  int64  `form:"company_id"`
	Status     string `form:"status"`
	DeviceType string `form:"device_type"`
	Search     string `form:"search"` // IMEI or vehicle reg
	Page       int    `form:"page,default=1"`
	PageSize   int    `form:"page_size,default=50"`
}

// DeviceAssignment links a device to a vehicle.
type DeviceAssignment struct {
	DeviceID  int64 `json:"device_id" binding:"required"`
	VehicleID int64 `json:"vehicle_id" binding:"required"`
}
