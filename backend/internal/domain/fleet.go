package domain

import "time"

// FleetParty represents a transport party/client for fleet operations.
type FleetParty struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	Phone     string    `json:"phone" db:"phone"`
	Email     string    `json:"email" db:"email"`
	Address   string    `json:"address" db:"address"`
	GSTIN     string    `json:"gstin" db:"gstin"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// LoadingReceipt (LR) represents a freight loading receipt.
type LoadingReceipt struct {
	ID          int64     `json:"id" db:"id"`
	CompanyID   int64     `json:"company_id" db:"company_id"`
	LRNumber    string    `json:"lr_number" db:"lr_number"`
	VehicleID   int64     `json:"vehicle_id" db:"vehicle_id"`
	PartyID     int64     `json:"party_id" db:"party_id"`
	Origin      string    `json:"origin" db:"origin"`
	Destination string    `json:"destination" db:"destination"`
	Material    string    `json:"material" db:"material"`
	Weight      float64   `json:"weight" db:"weight"`
	FreightAmt  float64   `json:"freight_amt" db:"freight_amt"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// GatePass represents a vehicle gate entry/exit pass.
type GatePass struct {
	ID        int64      `json:"id" db:"id"`
	CompanyID int64      `json:"company_id" db:"company_id"`
	VehicleID int64      `json:"vehicle_id" db:"vehicle_id"`
	DriverID  *int64     `json:"driver_id,omitempty" db:"driver_id"`
	Type      string     `json:"type" db:"type"` // entry, exit
	Purpose   string     `json:"purpose" db:"purpose"`
	EntryTime *time.Time `json:"entry_time,omitempty" db:"entry_time"`
	ExitTime  *time.Time `json:"exit_time,omitempty" db:"exit_time"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// Voucher represents a fleet expense voucher.
type Voucher struct {
	ID          int64     `json:"id" db:"id"`
	CompanyID   int64     `json:"company_id" db:"company_id"`
	VehicleID   int64     `json:"vehicle_id" db:"vehicle_id"`
	Type        string    `json:"type" db:"type"` // fuel, toll, maintenance, other
	Amount      float64   `json:"amount" db:"amount"`
	Description string    `json:"description" db:"description"`
	ReceiptNo   string    `json:"receipt_no" db:"receipt_no"`
	Date        time.Time `json:"date" db:"date"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// FuelRecord represents a fuel fill event.
type FuelRecord struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	VehicleID int64     `json:"vehicle_id" db:"vehicle_id"`
	Quantity  float64   `json:"quantity" db:"quantity"` // litres
	Cost      float64   `json:"cost" db:"cost"`
	Odometer  int64     `json:"odometer" db:"odometer"`
	Station   string    `json:"station" db:"station"`
	FilledAt  time.Time `json:"filled_at" db:"filled_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// TyreRecord represents a tyre lifecycle event.
type TyreRecord struct {
	ID          int64     `json:"id" db:"id"`
	CompanyID   int64     `json:"company_id" db:"company_id"`
	VehicleID   int64     `json:"vehicle_id" db:"vehicle_id"`
	TyreNumber  string    `json:"tyre_number" db:"tyre_number"`
	Position    string    `json:"position" db:"position"` // FL, FR, RL, RR, spare
	Brand       string    `json:"brand" db:"brand"`
	InstallDate time.Time `json:"install_date" db:"install_date"`
	Odometer    int64     `json:"odometer" db:"odometer"`
	Status      string    `json:"status" db:"status"` // active, retreaded, replaced, scrapped
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// Invoice represents a billing invoice.
type Invoice struct {
	ID        int64      `json:"id" db:"id"`
	CompanyID int64      `json:"company_id" db:"company_id"`
	Number    string     `json:"number" db:"number"`
	Amount    float64    `json:"amount" db:"amount"`
	Tax       float64    `json:"tax" db:"tax"`
	Total     float64    `json:"total" db:"total"`
	Status    string     `json:"status" db:"status"` // draft, sent, paid, overdue
	DueDate   time.Time  `json:"due_date" db:"due_date"`
	PaidAt    *time.Time `json:"paid_at,omitempty" db:"paid_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// Complaint represents a user-filed complaint.
type Complaint struct {
	ID          int64      `json:"id" db:"id"`
	CompanyID   int64      `json:"company_id" db:"company_id"`
	UserID      int64      `json:"user_id" db:"user_id"`
	Subject     string     `json:"subject" db:"subject"`
	Description string     `json:"description" db:"description"`
	Status      string     `json:"status" db:"status"` // open, in_progress, resolved, closed
	Priority    string     `json:"priority" db:"priority"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
}

// RFIDTag represents an RFID tag master.
type RFIDTag struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	TagCode   string    `json:"tag_code" db:"tag_code"`
	DriverID  *int64    `json:"driver_id,omitempty" db:"driver_id"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
