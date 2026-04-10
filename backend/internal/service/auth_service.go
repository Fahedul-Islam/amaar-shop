package service

import (
	"context"
	"fmt"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AuthService handles user registration, login, token refresh, and profile lookup.
type AuthService struct {
	users     repository.UserRepository
	jwtSecret string
}

func NewAuthService(users repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: jwtSecret}
}

// TokenPair holds the access and refresh tokens returned after authentication.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

// Signup registers a new user and returns tokens for immediate login.
func (s *AuthService) Signup(ctx context.Context, email, password string) (*domain.User, *TokenPair, error) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &domain.User{
		Email:        email,
		PasswordHash: hash,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, nil, err
	}

	tokens, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Login authenticates a user by email and password, returning tokens on success.
func (s *AuthService) Login(ctx context.Context, email, password string) (*domain.User, *TokenPair, error) {
	user, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		if err == domain.ErrUserNotFound {
			return nil, nil, domain.ErrInvalidCredentials
		}
		return nil, nil, err
	}

	if !auth.CheckPassword(password, user.PasswordHash) {
		return nil, nil, domain.ErrInvalidCredentials
	}

	tokens, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Refresh validates a refresh token and issues a new access token.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (string, error) {
	claims, err := auth.ValidateToken(refreshToken, s.jwtSecret, "refresh")
	if err != nil {
		return "", domain.ErrInvalidCredentials
	}

	// Verify the user still exists
	if _, err := s.users.FindByID(ctx, claims.UserID); err != nil {
		return "", domain.ErrInvalidCredentials
	}

	accessToken, err := auth.GenerateAccessToken(claims.UserID, s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("generating access token: %w", err)
	}

	return accessToken, nil
}

// Me returns the user profile for the given user ID.
func (s *AuthService) Me(ctx context.Context, userID string) (*domain.User, error) {
	return s.users.FindByID(ctx, userID)
}

// SeedAdmin creates an admin user if one doesn't already exist with the given email.
func (s *AuthService) SeedAdmin(ctx context.Context, email, password string) error {
	_, err := s.users.FindByEmail(ctx, email)
	if err == nil {
		return nil // admin already exists
	}
	if err != domain.ErrUserNotFound {
		return err
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hashing admin password: %w", err)
	}

	admin := &domain.User{
		Email:        email,
		PasswordHash: hash,
		IsAdmin:      true,
	}
	return s.users.Create(ctx, admin)
}

func (s *AuthService) generateTokens(userID string) (*TokenPair, error) {
	access, err := auth.GenerateAccessToken(userID, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	refresh, err := auth.GenerateRefreshToken(userID, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	return &TokenPair{AccessToken: access, RefreshToken: refresh}, nil
}
