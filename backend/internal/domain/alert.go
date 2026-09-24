package domain

import "time"

// Alert represents a triggered alert event.
type Alert struct {
	ID             int64     `json:"id" db:"id"`
	RuleID         int64     `json:"rule_id" db:"rule_id"`
	DeviceID       int64     `json:"device_id" db:"device_id"`
	Type           string    `json:"type" db:"type"` // overspeed, geofence_enter, geofence_exit, ignition, sos, idle
	Message        string    `json:"message" db:"message"`
	Latitude       float64   `json:"lat" db:"latitude"`
	Longitude      float64   `json:"lng" db:"longitude"`
	Acknowledged   bool      `json:"acknowledged" db:"acknowledged"`
	AcknowledgedBy *int64    `json:"acknowledged_by,omitempty" db:"acknowledged_by"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`

	// Joined fields
	RegNumber string `json:"reg_number,omitempty"`
}

// AlertRule defines conditions under which alerts should fire.
type AlertRule struct {
	ID           int64                  `json:"id" db:"id"`
	CompanyID    int64                  `json:"company_id" db:"company_id"`
	Name         string                 `json:"name" db:"name"`
	Type         string                 `json:"type" db:"type"` // overspeed, geofence, ignition, sos, idle, tow
	Config       map[string]interface{} `json:"config" db:"config"`
	SMSEnabled   bool                   `json:"sms_enabled" db:"sms_enabled"`
	EmailEnabled bool                   `json:"email_enabled" db:"email_enabled"`
	SMSTemplate  string                 `json:"sms_template" db:"sms_template"`
	Recipients   []AlertRecipient       `json:"recipients" db:"recipients"`
	IsActive     bool                   `json:"is_active" db:"is_active"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// AlertRecipient holds contact info for alert delivery.
type AlertRecipient struct {
	Name  string `json:"name"`
	Phone string `json:"phone,omitempty"`
	Email string `json:"email,omitempty"`
}

// SMSConfig holds SMS alert configuration for a specific device.
type SMSConfig struct {
	ID        int64    `json:"id" db:"id"`
	DeviceID  int64    `json:"device_id" db:"device_id"`
	CompanyID int64    `json:"company_id" db:"company_id"`
	Events    []string `json:"events"` // ignition_on, ignition_off, overspeed, geofence, sos
	Phones    []string `json:"phones"` // recipient phone numbers
	IsActive  bool     `json:"is_active" db:"is_active"`
}
