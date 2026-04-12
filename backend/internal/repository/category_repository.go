package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// CategoryRepository defines persistence operations for shop categories.
// Every method is scoped to a single shop (tenant isolation) — the shop_id
// must always participate in the WHERE clause of underlying queries.
type CategoryRepository interface {
	Create(ctx context.Context, c *domain.Category) error
	Update(ctx context.Context, c *domain.Category) error
	Delete(ctx context.Context, id, shopID string) error
	FindByID(ctx context.Context, id, shopID string) (*domain.Category, error)
	ListByShop(ctx context.Context, shopID string) ([]*domain.Category, error)
}
