package domain

import "time"

// Trip represents a planned or completed trip.
type Trip struct {
	ID            int64     `json:"id" db:"id"`
	CompanyID     int64     `json:"company_id" db:"company_id"`
	VehicleID     int64     `json:"vehicle_id" db:"vehicle_id"`
	DriverID      *int64    `json:"driver_id,omitempty" db:"driver_id"`
	StartLat      float64   `json:"start_lat" db:"start_lat"`
	StartLng      float64   `json:"start_lng" db:"start_lng"`
	EndLat        float64   `json:"end_lat" db:"end_lat"`
	EndLng        float64   `json:"end_lng" db:"end_lng"`
	StartAddress  string    `json:"start_address" db:"start_address"`
	EndAddress    string    `json:"end_address" db:"end_address"`
	StartTime     *time.Time `json:"start_time,omitempty" db:"start_time"`
	EndTime       *time.Time `json:"end_time,omitempty" db:"end_time"`
	DistanceKM    float64   `json:"distance_km" db:"distance_km"`
	Status        string    `json:"status" db:"status"` // planned, in_progress, completed, cancelled
	CreatedAt     time.Time `json:"created_at" db:"created_at"`

	// Joined fields
	VehicleReg string `json:"vehicle_reg,omitempty"`
	DriverName string `json:"driver_name,omitempty"`
}

// Route represents a predefined route with waypoints.
type Route struct {
	ID          int64       `json:"id" db:"id"`
	CompanyID   int64       `json:"company_id" db:"company_id"`
	Name        string      `json:"name" db:"name"`
	Description string      `json:"description" db:"description"`
	Waypoints   [][]float64 `json:"waypoints"` // [[lat, lng], ...]
	DistanceKM  float64     `json:"distance_km" db:"distance_km"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
}

// Driver represents a vehicle driver.
type Driver struct {
	ID               int64     `json:"id" db:"id"`
	CompanyID        int64     `json:"company_id" db:"company_id"`
	Name             string    `json:"name" db:"name"`
	Phone            string    `json:"phone" db:"phone"`
	LicenseNo        string    `json:"license_no" db:"license_no"`
	LicenseExpiry    *time.Time `json:"license_expiry,omitempty" db:"license_expiry"`
	RFIDTag          string    `json:"rfid_tag,omitempty" db:"rfid_tag"`
	AssignedVehicleID *int64   `json:"assigned_vehicle_id,omitempty" db:"assigned_vehicle_id"`
	Status           string    `json:"status" db:"status"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}
