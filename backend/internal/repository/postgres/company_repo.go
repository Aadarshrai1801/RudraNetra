package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rudra-netra/backend/internal/domain"
)

// CompanyRepository handles database operations for organizations / companies.
type CompanyRepository struct {
	pool *pgxpool.Pool
}

// NewCompanyRepository creates a new CompanyRepository.
func NewCompanyRepository(pool *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{pool: pool}
}

// List returns all active companies.
func (r *CompanyRepository) List(ctx context.Context) ([]domain.Company, error) {
	query := `
		SELECT id, name, code, COALESCE(address, ''), COALESCE(city, ''),
		       COALESCE(contact_person, ''), COALESCE(phone, ''), COALESCE(email, ''),
		       status, created_at, updated_at
		FROM companies
		ORDER BY id ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query companies: %w", err)
	}
	defer rows.Close()

	var companies []domain.Company
	for rows.Next() {
		var c domain.Company
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Code, &c.Address, &c.City,
			&c.ContactPerson, &c.Phone, &c.Email,
			&c.Status, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan company: %w", err)
		}
		companies = append(companies, c)
	}
	return companies, rows.Err()
}

// GetByID retrieves a single company by ID.
func (r *CompanyRepository) GetByID(ctx context.Context, id int64) (*domain.Company, error) {
	query := `
		SELECT id, name, code, COALESCE(address, ''), COALESCE(city, ''),
		       COALESCE(contact_person, ''), COALESCE(phone, ''), COALESCE(email, ''),
		       status, created_at, updated_at
		FROM companies
		WHERE id = $1
	`
	var c domain.Company
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.Name, &c.Code, &c.Address, &c.City,
		&c.ContactPerson, &c.Phone, &c.Email,
		&c.Status, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("company not found: %w", err)
	}
	return &c, nil
}
