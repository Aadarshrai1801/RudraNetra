// Package domain defines the core business entities for RudraNetra.
// These structs are used across all layers — handlers, services, repositories.
package domain

import "time"

// User represents an authenticated system user.
type User struct {
	ID           int64                  `json:"id" db:"id"`
	CompanyID    int64                  `json:"company_id" db:"company_id"`
	Username     string                 `json:"username" db:"username"`
	PasswordHash string                 `json:"-" db:"password_hash"` // never exposed in JSON
	FullName     string                 `json:"full_name" db:"full_name"`
	Email        string                 `json:"email" db:"email"`
	Phone        string                 `json:"phone" db:"phone"`
	Role         string                 `json:"role" db:"role"` // admin, manager, viewer, temp
	Permissions  map[string]interface{} `json:"permissions" db:"permissions"`
	IsActive     bool                   `json:"is_active" db:"is_active"`
	LastLoginAt  *time.Time             `json:"last_login_at" db:"last_login_at"`
	ExpiresAt    *time.Time             `json:"expires_at,omitempty" db:"expires_at"` // for temp users
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// LoginRequest is the payload for user authentication.
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// TokenPair holds JWT access and refresh tokens.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"` // unix timestamp
}

// ChangePasswordRequest is the payload for changing a user's password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}
