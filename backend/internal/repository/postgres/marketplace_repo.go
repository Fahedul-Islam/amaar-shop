package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

type marketplaceRepo struct {
	db *sql.DB
}

func NewMarketplaceRepo(db *sql.DB) repository.MarketplaceRepository {
	return &marketplaceRepo{db: db}
}

// ListProducts returns active, non-archived products across all non-suspended shops.
func (r *marketplaceRepo) ListProducts(ctx context.Context, filter domain.MarketplaceProductFilter) ([]*domain.MarketplaceProduct, int, error) {
	conditions := []string{
		"p.is_active = true",
		"p.is_archived = false",
		"s.is_suspended = false",
	}
	args := []interface{}{}
	argN := 1

	if filter.Query != "" {
		conditions = append(conditions, fmt.Sprintf("p.name %% $%d", argN))
		args = append(args, filter.Query)
		argN++
	}
	if filter.CategoryName != "" {
		conditions = append(conditions, fmt.Sprintf("LOWER(c.name) = LOWER($%d)", argN))
		args = append(args, filter.CategoryName)
		argN++
	}

	where := strings.Join(conditions, " AND ")

	joinClause := `FROM products p
		JOIN shops s ON s.id = p.shop_id
		LEFT JOIN categories c ON c.id = p.category_id`

	// Count total.
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) %s WHERE %s", joinClause, where)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("marketplace count: %w", err)
	}

	// Fetch page.
	listArgs := append(append([]interface{}{}, args...), filter.PageSize, filter.Offset())
	query := fmt.Sprintf(
		`SELECT p.id, p.shop_id, p.category_id, p.name, COALESCE(p.description, ''),
		        p.price_bdt::text, p.stock, p.is_active, p.is_archived,
		        p.created_at, p.updated_at,
		        s.name, s.slug, COALESCE(s.logo_url, '')
		 %s
		 WHERE %s
		 ORDER BY p.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		joinClause, where, argN, argN+1,
	)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("marketplace list: %w", err)
	}
	defer rows.Close()

	products := make([]*domain.MarketplaceProduct, 0)
	ids := make([]string, 0)
	for rows.Next() {
		mp := &domain.MarketplaceProduct{}
		var categoryID sql.NullString
		var description sql.NullString
		if err := rows.Scan(
			&mp.ID, &mp.ShopID, &categoryID, &mp.Name, &description, &mp.PriceBDT,
			&mp.Stock, &mp.IsActive, &mp.IsArchived, &mp.CreatedAt, &mp.UpdatedAt,
			&mp.ShopName, &mp.ShopSlug, &mp.ShopLogoURL,
		); err != nil {
			return nil, 0, fmt.Errorf("marketplace scan: %w", err)
		}
		if categoryID.Valid {
			mp.CategoryID = &categoryID.String
		}
		mp.Description = description.String
		mp.Images = []domain.ProductImage{}
		products = append(products, mp)
		ids = append(ids, mp.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Attach images.
	if len(ids) > 0 {
		if err := r.attachImages(ctx, products, ids); err != nil {
			return nil, 0, err
		}
	}

	return products, total, nil
}

// attachImages fetches images for the given product IDs and distributes them.
func (r *marketplaceRepo) attachImages(ctx context.Context, products []*domain.MarketplaceProduct, ids []string) error {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, product_id, url, sort_order, created_at
		 FROM product_images
		 WHERE product_id = ANY($1)
		 ORDER BY product_id, sort_order ASC`,
		pq.Array(ids),
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	byID := make(map[string]*domain.MarketplaceProduct, len(products))
	for _, p := range products {
		byID[p.ID] = p
	}

	for rows.Next() {
		img := domain.ProductImage{}
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.SortOrder, &img.CreatedAt); err != nil {
			return err
		}
		if p, ok := byID[img.ProductID]; ok {
			p.Images = append(p.Images, img)
		}
	}
	return rows.Err()
}

// ListShops returns non-suspended shops, optionally filtered by name similarity.
func (r *marketplaceRepo) ListShops(ctx context.Context, query string, limit, offset int) ([]*domain.Shop, int, error) {
	conditions := []string{"is_suspended = false"}
	args := []interface{}{}
	argN := 1

	if query != "" {
		conditions = append(conditions, fmt.Sprintf("name %% $%d", argN))
		args = append(args, query)
		argN++
	}

	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM shops WHERE "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("marketplace shops count: %w", err)
	}

	listArgs := append(append([]interface{}{}, args...), limit, offset)
	q := fmt.Sprintf(
		`SELECT id, owner_user_id, slug, name, COALESCE(description,''),
		        COALESCE(logo_url,''), COALESCE(banner_url,''),
		        COALESCE(contact_phone,''), is_suspended, created_at, updated_at
		 FROM shops
		 WHERE %s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)

	rows, err := r.db.QueryContext(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("marketplace shops list: %w", err)
	}
	defer rows.Close()

	shops := make([]*domain.Shop, 0)
	for rows.Next() {
		s := &domain.Shop{}
		if err := rows.Scan(
			&s.ID, &s.OwnerUserID, &s.Slug, &s.Name, &s.Description,
			&s.LogoURL, &s.BannerURL, &s.ContactPhone, &s.IsSuspended,
			&s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("marketplace shops scan: %w", err)
		}
		shops = append(shops, s)
	}
	return shops, total, rows.Err()
}

// ListCategories returns distinct category names across all non-suspended shops.
func (r *marketplaceRepo) ListCategories(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT DISTINCT c.name
		 FROM categories c
		 JOIN shops s ON s.id = c.shop_id
		 WHERE s.is_suspended = false
		 ORDER BY c.name`)
	if err != nil {
		return nil, fmt.Errorf("marketplace categories: %w", err)
	}
	defer rows.Close()

	names := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// LookupOrdersByPhone returns all orders matching the given phone number across all shops.
func (r *marketplaceRepo) LookupOrdersByPhone(ctx context.Context, phone string) ([]*domain.Order, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+orderColumns+`
		 FROM orders o
		 WHERE o.customer_phone = $1
		 ORDER BY o.created_at DESC
		 LIMIT 50`,
		phone,
	)
	if err != nil {
		return nil, fmt.Errorf("marketplace order lookup: %w", err)
	}
	defer rows.Close()

	var orders []*domain.Order
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, fmt.Errorf("marketplace order scan: %w", err)
		}
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []*domain.Order{}
	}
	return orders, rows.Err()
}
