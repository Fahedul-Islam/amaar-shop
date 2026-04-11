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

type shopRepo struct {
	db database.DBTX
}

func NewShopRepo(db database.DBTX) repository.ShopRepository {
	return &shopRepo{db: db}
}

func (r *shopRepo) Create(ctx context.Context, shop *domain.Shop) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO shops (owner_user_id, slug, name, description, contact_phone)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, COALESCE(logo_url,''), COALESCE(banner_url,''), is_suspended, created_at, updated_at`,
		shop.OwnerUserID, shop.Slug, shop.Name, shop.Description, shop.ContactPhone,
	).Scan(&shop.ID, &shop.LogoURL, &shop.BannerURL, &shop.IsSuspended, &shop.CreatedAt, &shop.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) {
			switch pqErr.Code {
			case "23505":
				if pqErr.Constraint == "shops_owner_user_id_key" {
					return domain.ErrShopAlreadyExists
				}
				if pqErr.Constraint == "shops_slug_key" {
					return domain.ErrSlugTaken
				}
			}
		}
		return err
	}
	return nil
}

func (r *shopRepo) FindByID(ctx context.Context, id string) (*domain.Shop, error) {
	return r.scanShop(r.db.QueryRowContext(ctx,
		`SELECT id, owner_user_id, slug, name, COALESCE(description,''), COALESCE(logo_url,''),
		        COALESCE(banner_url,''), COALESCE(contact_phone,''), is_suspended, created_at, updated_at
		 FROM shops WHERE id = $1`, id))
}

func (r *shopRepo) FindBySlug(ctx context.Context, slug string) (*domain.Shop, error) {
	return r.scanShop(r.db.QueryRowContext(ctx,
		`SELECT id, owner_user_id, slug, name, COALESCE(description,''), COALESCE(logo_url,''),
		        COALESCE(banner_url,''), COALESCE(contact_phone,''), is_suspended, created_at, updated_at
		 FROM shops WHERE slug = $1`, slug))
}

func (r *shopRepo) FindByOwnerID(ctx context.Context, ownerUserID string) (*domain.Shop, error) {
	return r.scanShop(r.db.QueryRowContext(ctx,
		`SELECT id, owner_user_id, slug, name, COALESCE(description,''), COALESCE(logo_url,''),
		        COALESCE(banner_url,''), COALESCE(contact_phone,''), is_suspended, created_at, updated_at
		 FROM shops WHERE owner_user_id = $1`, ownerUserID))
}

func (r *shopRepo) Update(ctx context.Context, shop *domain.Shop) error {
	err := r.db.QueryRowContext(ctx,
		`UPDATE shops
		 SET name = $1,
		     description = NULLIF($2, ''),
		     contact_phone = NULLIF($3, ''),
		     logo_url = NULLIF($4, ''),
		     banner_url = NULLIF($5, '')
		 WHERE id = $6
		 RETURNING updated_at`,
		shop.Name, shop.Description, shop.ContactPhone, shop.LogoURL, shop.BannerURL, shop.ID,
	).Scan(&shop.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrShopNotFound
	}
	return err
}

func (r *shopRepo) IsSlugAvailable(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM shops WHERE slug = $1)`, slug,
	).Scan(&exists)
	if err != nil {
		return false, err
	}
	return !exists, nil
}

func (r *shopRepo) scanShop(row *sql.Row) (*domain.Shop, error) {
	s := &domain.Shop{}
	err := row.Scan(
		&s.ID, &s.OwnerUserID, &s.Slug, &s.Name, &s.Description,
		&s.LogoURL, &s.BannerURL, &s.ContactPhone, &s.IsSuspended,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrShopNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}
