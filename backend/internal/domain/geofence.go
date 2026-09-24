package domain

import "time"

// Geofence represents a geographic boundary zone defined as a PostGIS polygon.
type Geofence struct {
	ID           int64     `json:"id" db:"id"`
	CompanyID    int64     `json:"company_id" db:"company_id"`
	Name         string    `json:"name" db:"name"`
	Type         string    `json:"type" db:"type"` // zone, route, poi
	AlertOnEnter bool      `json:"alert_on_enter" db:"alert_on_enter"`
	AlertOnExit  bool      `json:"alert_on_exit" db:"alert_on_exit"`
	SpeedLimit   *int      `json:"speed_limit,omitempty" db:"speed_limit"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`

	// GeoJSON representation for the frontend
	Coordinates [][]float64 `json:"coordinates,omitempty"` // [[lng, lat], ...]
}

// GeofenceCreateRequest is the payload for creating a new geofence.
type GeofenceCreateRequest struct {
	Name         string      `json:"name" binding:"required"`
	Type         string      `json:"type" binding:"required,oneof=zone route poi"`
	Coordinates  [][]float64 `json:"coordinates" binding:"required"` // polygon vertices
	AlertOnEnter bool        `json:"alert_on_enter"`
	AlertOnExit  bool        `json:"alert_on_exit"`
	SpeedLimit   *int        `json:"speed_limit,omitempty"`
}

// GeofenceCheckResult indicates whether a point is inside a geofence.
type GeofenceCheckResult struct {
	GeofenceID   int64  `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	IsInside     bool   `json:"is_inside"`
}

// POI represents a Point of Interest stored as a PostGIS point.
type POI struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	Latitude  float64   `json:"lat" db:"latitude"`
	Longitude float64   `json:"lng" db:"longitude"`
	Category  string    `json:"category" db:"category"`
	Address   string    `json:"address" db:"address"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// NearestPOIRequest defines parameters for finding nearest POIs.
type NearestPOIRequest struct {
	Latitude  float64 `form:"lat" binding:"required"`
	Longitude float64 `form:"lng" binding:"required"`
	RadiusM   float64 `form:"radius" binding:"required"` // radius in meters
	Limit     int     `form:"limit,default=10"`
}

// NearestPOIResult holds a POI with its distance from the query point.
type NearestPOIResult struct {
	POI
	DistanceM float64 `json:"distance_m"` // distance in meters
}
