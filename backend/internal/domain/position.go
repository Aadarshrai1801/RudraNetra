package domain

import (
	"encoding/json"
	"time"
)

// Position represents a GPS position received from a device.
// Stored in a TimescaleDB hypertable for efficient time-range queries.
type Position struct {
	Time        time.Time       `json:"time" db:"time"`
	DeviceID    int64           `json:"device_id" db:"device_id"`
	Latitude    float64         `json:"lat" db:"latitude"`
	Longitude   float64         `json:"lng" db:"longitude"`
	Speed       float32         `json:"speed" db:"speed"`
	Heading     float32         `json:"heading" db:"heading"`
	Altitude    float32         `json:"altitude" db:"altitude"`
	Satellites  int16           `json:"satellites" db:"satellites"`
	Ignition    bool            `json:"ignition" db:"ignition"`
	GSMSignal   int16           `json:"gsm_signal" db:"gsm_signal"`
	Voltage     float32         `json:"voltage" db:"voltage"`
	Temperature float32         `json:"temperature" db:"temperature"`
	Odometer    int64           `json:"odometer" db:"odometer"`
	RFIDTag     string          `json:"rfid_tag,omitempty" db:"rfid_tag"`
	RawData     json.RawMessage `json:"raw_data,omitempty" db:"raw_data"` // all IO elements
}

// LivePosition is a Position enriched with vehicle info for WebSocket broadcast.
type LivePosition struct {
	Position
	RegNumber string `json:"reg_number"`
	Make      string `json:"make,omitempty"`
	Model     string `json:"model,omitempty"`
	IconType  string `json:"icon_type,omitempty"`
	Status    string `json:"status"` // moving, idle, stopped, offline
}

// HistoryRequest defines parameters for fetching position history.
type HistoryRequest struct {
	DeviceID  int64     `form:"device_id" binding:"required"`
	StartTime time.Time `form:"start_time" binding:"required" time_format:"2006-01-02T15:04:05Z07:00"`
	EndTime   time.Time `form:"end_time" binding:"required" time_format:"2006-01-02T15:04:05Z07:00"`
}

// TrackPoint is a simplified position for route playback.
type TrackPoint struct {
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Speed     float32   `json:"speed"`
	Heading   float32   `json:"heading"`
	Ignition  bool      `json:"ignition"`
	Timestamp time.Time `json:"timestamp"`
}

// DistanceSummary holds computed distance for a device over a time range.
type DistanceSummary struct {
	DeviceID   int64   `json:"device_id"`
	DistanceKM float64 `json:"distance_km"`
	StartTime  string  `json:"start_time"`
	EndTime    string  `json:"end_time"`
}
