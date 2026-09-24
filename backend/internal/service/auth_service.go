package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	"golang.org/x/crypto/bcrypt"
)

// AuthService handles authentication, JWT generation, and password validation.
type AuthService struct {
	userRepo *postgres.UserRepository
	cfg      *config.JWTConfig
}

// NewAuthService creates a new AuthService.
func NewAuthService(userRepo *postgres.UserRepository, cfg *config.JWTConfig) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		cfg:      cfg,
	}
}

// Authenticate verifies user credentials and issues an access/refresh token pair.
func (s *AuthService) Authenticate(ctx context.Context, username, password string) (*domain.TokenPair, *domain.User, error) {
	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return nil, nil, errors.New("invalid username or password")
	}

	if !user.IsActive {
		return nil, nil, errors.New("user account is deactivated")
	}

	if user.ExpiresAt != nil && time.Now().After(*user.ExpiresAt) {
		return nil, nil, errors.New("temporary account has expired")
	}

	// Verify bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, errors.New("invalid username or password")
	}

	tokens, err := s.GenerateTokenPair(user)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	return tokens, user, nil
}

// GenerateTokenPair creates new access and refresh JWTs for a user.
func (s *AuthService) GenerateTokenPair(user *domain.User) (*domain.TokenPair, error) {
	now := time.Now()
	accessExpiry := now.Add(s.cfg.AccessTokenTTL)
	refreshExpiry := now.Add(s.cfg.RefreshTokenTTL)

	// Access Token
	accessClaims := jwt.MapClaims{
		"sub":        user.ID,
		"company_id": user.CompanyID,
		"username":   user.Username,
		"role":       user.Role,
		"exp":        accessExpiry.Unix(),
		"iat":        now.Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(s.cfg.Secret))
	if err != nil {
		return nil, err
	}

	// Refresh Token
	refreshClaims := jwt.MapClaims{
		"sub": user.ID,
		"exp": refreshExpiry.Unix(),
		"iat": now.Unix(),
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(s.cfg.Secret))
	if err != nil {
		return nil, err
	}

	return &domain.TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
		ExpiresAt:    accessExpiry.Unix(),
	}, nil
}
