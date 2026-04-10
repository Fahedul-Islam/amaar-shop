package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

// userRepo implements repository.UserRepository using PostgreSQL.
type userRepo struct {
	db database.DBTX
}

func NewUserRepo(db database.DBTX) repository.UserRepository {
	return &userRepo{db: db}
}

func (r *userRepo) Create(ctx context.Context, user *domain.User) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, is_admin)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at, updated_at`,
		user.Email, user.PasswordHash, user.IsAdmin,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return domain.ErrEmailAlreadyExists
		}
		return err
	}
	return nil
}

func (r *userRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, is_admin, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *userRepo) FindByID(ctx context.Context, id string) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, is_admin, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
