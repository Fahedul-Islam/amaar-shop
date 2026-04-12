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

type categoryRepo struct {
	db database.DBTX
}

func NewCategoryRepo(db database.DBTX) repository.CategoryRepository {
	return &categoryRepo{db: db}
}

func (r *categoryRepo) Create(ctx context.Context, c *domain.Category) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO categories (shop_id, name)
		 VALUES ($1, $2)
		 RETURNING id, created_at`,
		c.ShopID, c.Name,
	).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return domain.ErrCategoryNameTaken
		}
		return err
	}
	return nil
}

func (r *categoryRepo) Update(ctx context.Context, c *domain.Category) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE categories SET name = $1 WHERE id = $2 AND shop_id = $3`,
		c.Name, c.ID, c.ShopID,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return domain.ErrCategoryNameTaken
		}
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrCategoryNotFound
	}
	return nil
}

func (r *categoryRepo) Delete(ctx context.Context, id, shopID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM categories WHERE id = $1 AND shop_id = $2`,
		id, shopID,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrCategoryNotFound
	}
	return nil
}

func (r *categoryRepo) FindByID(ctx context.Context, id, shopID string) (*domain.Category, error) {
	c := &domain.Category{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, shop_id, name, created_at
		 FROM categories
		 WHERE id = $1 AND shop_id = $2`,
		id, shopID,
	).Scan(&c.ID, &c.ShopID, &c.Name, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrCategoryNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *categoryRepo) ListByShop(ctx context.Context, shopID string) ([]*domain.Category, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, shop_id, name, created_at
		 FROM categories
		 WHERE shop_id = $1
		 ORDER BY lower(name) ASC`,
		shopID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.Category, 0)
	for rows.Next() {
		c := &domain.Category{}
		if err := rows.Scan(&c.ID, &c.ShopID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
