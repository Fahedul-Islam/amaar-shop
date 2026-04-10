package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// UserRepository defines persistence operations for user accounts.
type UserRepository interface {
	// Create inserts a new user and returns it with generated fields populated.
	Create(ctx context.Context, user *domain.User) error

	// FindByEmail looks up a user by their email address.
	FindByEmail(ctx context.Context, email string) (*domain.User, error)

	// FindByID looks up a user by their UUID.
	FindByID(ctx context.Context, id string) (*domain.User, error)
}
