package domain

// PaginatedResponse wraps any list response with pagination metadata.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

// APIResponse is a standardized API response wrapper.
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// DashboardSummary holds aggregated fleet overview data.
type DashboardSummary struct {
	TotalDevices    int `json:"total_devices"`
	ActiveDevices   int `json:"active_devices"`
	InactiveDevices int `json:"inactive_devices"`
	MovingVehicles  int `json:"moving_vehicles"`
	IdleVehicles    int `json:"idle_vehicles"`
	StoppedVehicles int `json:"stopped_vehicles"`
	OverspeedCount  int `json:"overspeed_count"`
	AlertsToday     int `json:"alerts_today"`
}

// ReportType enumerates available report types.
type ReportType string

const (
	ReportDistance     ReportType = "distance"
	ReportSpeed        ReportType = "speed"
	ReportStoppage     ReportType = "stoppage"
	ReportTrip         ReportType = "trip"
	ReportFuel         ReportType = "fuel"
	ReportGeofence     ReportType = "geofence"
	ReportIgnition     ReportType = "ignition"
	ReportIdling       ReportType = "idling"
	ReportRFID         ReportType = "rfid"
	ReportDailySummary ReportType = "daily_summary"
)

// ReportRequest defines parameters for generating a report.
type ReportRequest struct {
	Type      ReportType `form:"type" binding:"required"`
	DeviceIDs []int64    `form:"device_ids"`
	StartTime string     `form:"start_time" binding:"required"`
	EndTime   string     `form:"end_time" binding:"required"`
	Format    string     `form:"format,default=json"` // json, excel, pdf
}

// DistanceReportRow represents aggregated vehicle distance metrics.
type DistanceReportRow struct {
	DeviceID      int64   `json:"device_id"`
	RegNumber     string  `json:"reg_number"`
	StartOdometer int64   `json:"start_odometer"`
	EndOdometer   int64   `json:"end_odometer"`
	DistanceKM    float64 `json:"distance_km"`
	MaxSpeed      float32 `json:"max_speed"`
	AvgSpeed      float32 `json:"avg_speed"`
	MovingTimeMin int     `json:"moving_time_min"`
	IdleTimeMin   int     `json:"idle_time_min"`
	StopTimeMin   int     `json:"stop_time_min"`
}

// SpeedViolationRow represents an individual overspeed occurrence.
type SpeedViolationRow struct {
	DeviceID   int64   `json:"device_id"`
	RegNumber  string  `json:"reg_number"`
	Time       string  `json:"time"`
	Speed      float32 `json:"speed"`
	SpeedLimit int     `json:"speed_limit"`
	ExceededBy float32 `json:"exceeded_by"`
	Latitude   float64 `json:"lat"`
	Longitude  float64 `json:"lng"`
	Location   string  `json:"location,omitempty"`
}

// StoppageReportRow represents a stationary engine event.
type StoppageReportRow struct {
	DeviceID        int64   `json:"device_id"`
	RegNumber       string  `json:"reg_number"`
	StopTime        string  `json:"stop_time"`
	ResumeTime      string  `json:"resume_time"`
	DurationMinutes int     `json:"duration_minutes"`
	Latitude        float64 `json:"lat"`
	Longitude       float64 `json:"lng"`
	LocationName    string  `json:"location_name,omitempty"`
}

// TripReportRow represents completed or active trips with start/end details.
type TripReportRow struct {
	TripID          int64   `json:"trip_id"`
	DeviceID        int64   `json:"device_id"`
	RegNumber       string  `json:"reg_number"`
	DriverName      string  `json:"driver_name"`
	StartTime       string  `json:"start_time"`
	EndTime         string  `json:"end_time"`
	StartLocation   string  `json:"start_location"`
	EndLocation     string  `json:"end_location"`
	DistanceKM      float64 `json:"distance_km"`
	DurationMinutes int     `json:"duration_minutes"`
}
