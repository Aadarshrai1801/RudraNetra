package domain

import "time"

// Company represents a tenant / client organization.
type Company struct {
	ID            int64     `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Code          string    `json:"code" db:"code"`
	DatabaseName  string    `json:"database_name,omitempty" db:"database_name"` // legacy compat
	Address       string    `json:"address" db:"address"`
	City          string    `json:"city" db:"city"`
	ContactPerson string    `json:"contact_person" db:"contact_person"`
	Phone         string    `json:"phone" db:"phone"`
	Email         string    `json:"email" db:"email"`
	Status        int       `json:"status" db:"status"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// Branch represents a company branch office.
type Branch struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	Address   string    `json:"address" db:"address"`
	City      string    `json:"city" db:"city"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Department represents a company department.
type Department struct {
	ID        int64     `json:"id" db:"id"`
	CompanyID int64     `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
