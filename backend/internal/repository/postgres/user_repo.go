package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// UserRepository handles database queries for users.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// GetByUsername returns a User by their unique username.
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	query := `
		SELECT id, COALESCE(company_id, 0), username, password_hash,
		       COALESCE(full_name, ''), COALESCE(email, ''), COALESCE(phone, ''),
		       role, COALESCE(permissions, '{}'), is_active, last_login_at, expires_at, created_at
		FROM users
		WHERE username = $1
	`
	var u domain.User
	var permBytes []byte
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&u.ID,
		&u.CompanyID,
		&u.Username,
		&u.PasswordHash,
		&u.FullName,
		&u.Email,
		&u.Phone,
		&u.Role,
		&permBytes,
		&u.IsActive,
		&u.LastLoginAt,
		&u.ExpiresAt,
		&u.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	if len(permBytes) > 0 {
		_ = json.Unmarshal(permBytes, &u.Permissions)
	}

	return &u, nil
}

// UpdateLastLogin updates the timestamp when the user logged in.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID int64) error {
	query := `UPDATE users SET last_login_at = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, time.Now(), userID)
	return err
}

// UpdatePassword updates a user's password hash.
func (r *UserRepository) UpdatePassword(ctx context.Context, userID int64, newHash string) error {
	query := `UPDATE users SET password_hash = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, newHash, userID)
	return err
}

// Create inserts a new user record.
func (r *UserRepository) Create(ctx context.Context, u *domain.User) (*domain.User, error) {
	query := `
		INSERT INTO users (
			company_id, username, password_hash, full_name, email, phone, role, is_active
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8
		)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query,
		u.CompanyID,
		u.Username,
		u.PasswordHash,
		u.FullName,
		u.Email,
		u.Phone,
		u.Role,
		u.IsActive,
	).Scan(&u.ID, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return u, nil
}

// GetByID returns a User by their primary key.
func (r *UserRepository) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	query := `
		SELECT id, COALESCE(company_id, 0), username, password_hash,
		       COALESCE(full_name, ''), COALESCE(email, ''), COALESCE(phone, ''),
		       role, COALESCE(permissions, '{}'), is_active, last_login_at, expires_at, created_at
		FROM users
		WHERE id = $1
	`
	var u domain.User
	var permBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.CompanyID,
		&u.Username,
		&u.PasswordHash,
		&u.FullName,
		&u.Email,
		&u.Phone,
		&u.Role,
		&permBytes,
		&u.IsActive,
		&u.LastLoginAt,
		&u.ExpiresAt,
		&u.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	if len(permBytes) > 0 {
		_ = json.Unmarshal(permBytes, &u.Permissions)
	}

	return &u, nil
}
