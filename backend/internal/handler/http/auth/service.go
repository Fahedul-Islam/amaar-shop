// Package auth contains HTTP handlers for authentication endpoints.
package auth

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the auth handler depends on.
// Defined here (at the consumer) so the handler can be built and tested
// without importing the concrete service package.
type Service interface {
	Signup(ctx context.Context, email, password string) (*domain.User, *domain.TokenPair, error)
	Login(ctx context.Context, email, password string) (*domain.User, *domain.TokenPair, error)
	Refresh(ctx context.Context, refreshToken string) (string, error)
	Me(ctx context.Context, userID string) (*domain.User, error)
}
