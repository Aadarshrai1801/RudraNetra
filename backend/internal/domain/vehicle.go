package domain

import "time"

// Vehicle represents a tracked vehicle with its configuration.
type Vehicle struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	DeviceID  *int64    `json:"device_id,omitempty" db:"device_id"`
	RegNumber string    `json:"reg_number" db:"reg_number"`
	Make      string    `json:"make" db:"make"`
	Model     string    `json:"model" db:"model"`
	Variant   string    `json:"variant" db:"variant"`
	BodyType  string    `json:"body_type" db:"body_type"`
	FuelType  string    `json:"fuel_type" db:"fuel_type"`
	MaxSpeed  int       `json:"max_speed" db:"max_speed"`
	Odometer  int64     `json:"odometer" db:"odometer"`
	IconType  string    `json:"icon_type" db:"icon_type"` // car, truck, bus, bike
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// VehicleConfig holds configurable vehicle parameters.
type VehicleConfig struct {
	VehicleID    int64  `json:"vehicle_id" binding:"required"`
	MaxSpeed     int    `json:"max_speed"`
	IdleTimeout  int    `json:"idle_timeout"` // minutes
	StopTimeout  int    `json:"stop_timeout"` // minutes
	IconType     string `json:"icon_type"`
	FuelCapacity int    `json:"fuel_capacity"` // litres
}

// Brand represents a vehicle brand (make) master.
type Brand struct {
	ID   int64  `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
}

// VehicleModel represents a vehicle model master.
type VehicleModel struct {
	ID      int64  `json:"id" db:"id"`
	BrandID int64  `json:"brand_id" db:"brand_id"`
	Name    string `json:"name" db:"name"`
}

// VehicleWithTelemetry extends Vehicle with the latest GPS tracking data and driver details.
type VehicleWithTelemetry struct {
	ID           int64      `json:"id"`
	CompanyID    int64      `json:"company_id"`
	DeviceID     *int64     `json:"device_id,omitempty"`
	RegNumber    string     `json:"reg_number"`
	Make         string     `json:"make"`
	Model        string     `json:"model"`
	Variant      string     `json:"variant"`
	BodyType     string     `json:"body_type"`
	FuelType     string     `json:"fuel_type"`
	FuelCapacity float64    `json:"fuel_capacity,omitempty"`
	MaxSpeed     int        `json:"max_speed"`
	Odometer     int64      `json:"odometer"`
	IconType     string     `json:"icon_type"`
	Status       string     `json:"status"` // moving, idle, stopped, offline
	Online       bool       `json:"online"` // position received within the freshness window
	DriverName   string     `json:"driver_name,omitempty"`
	DriverPhone  string     `json:"driver_phone,omitempty"`
	LocationName string     `json:"location_name,omitempty"`
	Lat          *float64   `json:"lat,omitempty"`
	Lng          *float64   `json:"lng,omitempty"`
	Speed        *float64   `json:"speed,omitempty"`
	Heading      *float64   `json:"heading,omitempty"`
	Ignition     *bool      `json:"ignition,omitempty"`
	Temperature  *float64   `json:"temperature,omitempty"`
	FuelPct      *float64   `json:"fuel_pct,omitempty"`
	BatteryV     *float64   `json:"battery_v,omitempty"`
	Timestamp    *time.Time `json:"timestamp,omitempty"`
}
