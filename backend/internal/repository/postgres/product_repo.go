package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

type productRepo struct {
	db database.DBTX
}

func NewProductRepo(db database.DBTX) repository.ProductRepository {
	return &productRepo{db: db}
}

func (r *productRepo) Create(ctx context.Context, p *domain.Product) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO products
		   (shop_id, category_id, name, description, price_bdt, stock, is_active,
		    discount_type, discount_value, delivery_charge_dhaka, delivery_charge_outside)
		 VALUES ($1, $2, $3, NULLIF($4, ''), $5::numeric, $6, $7,
		         $8, $9::numeric, $10::numeric, $11::numeric)
		 RETURNING id, is_archived, created_at, updated_at`,
		p.ShopID, p.CategoryID, p.Name, p.Description, p.PriceBDT, p.Stock, p.IsActive,
		p.DiscountType, p.DiscountValue, p.DeliveryChargeDhaka, p.DeliveryChargeOutside,
	).Scan(&p.ID, &p.IsArchived, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return err
	}
	p.Images = []domain.ProductImage{}
	return nil
}

func (r *productRepo) Update(ctx context.Context, p *domain.Product) error {
	err := r.db.QueryRowContext(ctx,
		`UPDATE products
		 SET category_id = $1,
		     name = $2,
		     description = NULLIF($3, ''),
		     price_bdt = $4::numeric,
		     stock = $5,
		     is_active = $6,
		     discount_type = $7,
		     discount_value = $8::numeric,
		     delivery_charge_dhaka = $9::numeric,
		     delivery_charge_outside = $10::numeric
		 WHERE id = $11 AND shop_id = $12
		 RETURNING updated_at`,
		p.CategoryID, p.Name, p.Description, p.PriceBDT, p.Stock, p.IsActive,
		p.DiscountType, p.DiscountValue, p.DeliveryChargeDhaka, p.DeliveryChargeOutside,
		p.ID, p.ShopID,
	).Scan(&p.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrProductNotFound
	}
	return err
}

func (r *productRepo) Archive(ctx context.Context, id, shopID string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE products SET is_archived = true WHERE id = $1 AND shop_id = $2`,
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
		return domain.ErrProductNotFound
	}
	return nil
}

func (r *productRepo) Delete(ctx context.Context, id, shopID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM products WHERE id = $1 AND shop_id = $2`,
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
		return domain.ErrProductNotFound
	}
	return nil
}

func (r *productRepo) FindByID(ctx context.Context, id, shopID string) (*domain.Product, error) {
	p := &domain.Product{}
	var categoryID, description, discountType, discountValue, deliveryDhaka, deliveryOutside sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, shop_id, category_id, name, COALESCE(description, ''), price_bdt::text,
		        stock, is_active, is_archived,
		        discount_type, discount_value::text, delivery_charge_dhaka::text, delivery_charge_outside::text,
		        created_at, updated_at
		 FROM products
		 WHERE id = $1 AND shop_id = $2`,
		id, shopID,
	).Scan(
		&p.ID, &p.ShopID, &categoryID, &p.Name, &description, &p.PriceBDT,
		&p.Stock, &p.IsActive, &p.IsArchived,
		&discountType, &discountValue, &deliveryDhaka, &deliveryOutside,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrProductNotFound
	}
	if err != nil {
		return nil, err
	}
	if categoryID.Valid {
		p.CategoryID = &categoryID.String
	}
	p.Description = description.String
	if discountType.Valid {
		p.DiscountType = &discountType.String
	}
	if discountValue.Valid {
		p.DiscountValue = &discountValue.String
	}
	if deliveryDhaka.Valid {
		p.DeliveryChargeDhaka = &deliveryDhaka.String
	}
	if deliveryOutside.Valid {
		p.DeliveryChargeOutside = &deliveryOutside.String
	}

	images, err := r.ListImages(ctx, p.ID, shopID)
	if err != nil {
		return nil, err
	}
	p.Images = derefImages(images)
	return p, nil
}

// ListByShop applies the filter (with tenant scoping on shop_id) and returns
// the matching products along with the total count for pagination.
func (r *productRepo) ListByShop(ctx context.Context, shopID string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	conditions := []string{"shop_id = $1"}
	args := []interface{}{shopID}
	argN := 2

	if filter.Query != "" {
		conditions = append(conditions, fmt.Sprintf("name %% $%d", argN))
		args = append(args, filter.Query)
		argN++
	}
	if filter.CategoryID != nil {
		conditions = append(conditions, fmt.Sprintf("category_id = $%d", argN))
		args = append(args, *filter.CategoryID)
		argN++
	}
	if filter.IsActive != nil {
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", argN))
		args = append(args, *filter.IsActive)
		argN++
	}
	if filter.IsArchived != nil {
		conditions = append(conditions, fmt.Sprintf("is_archived = $%d", argN))
		args = append(args, *filter.IsArchived)
		argN++
	}

	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM products WHERE "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(append([]interface{}{}, args...), filter.PageSize, filter.Offset())
	query := fmt.Sprintf(
		`SELECT id, shop_id, category_id, name, COALESCE(description, ''), price_bdt::text,
		        stock, is_active, is_archived,
		        discount_type, discount_value::text, delivery_charge_dhaka::text, delivery_charge_outside::text,
		        created_at, updated_at
		 FROM products
		 WHERE %s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := make([]*domain.Product, 0)
	ids := make([]string, 0)
	for rows.Next() {
		p := &domain.Product{}
		var categoryID, description, discountType, discountValue, deliveryDhaka, deliveryOutside sql.NullString
		if err := rows.Scan(
			&p.ID, &p.ShopID, &categoryID, &p.Name, &description, &p.PriceBDT,
			&p.Stock, &p.IsActive, &p.IsArchived,
			&discountType, &discountValue, &deliveryDhaka, &deliveryOutside,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if categoryID.Valid {
			p.CategoryID = &categoryID.String
		}
		p.Description = description.String
		if discountType.Valid {
			p.DiscountType = &discountType.String
		}
		if discountValue.Valid {
			p.DiscountValue = &discountValue.String
		}
		if deliveryDhaka.Valid {
			p.DeliveryChargeDhaka = &deliveryDhaka.String
		}
		if deliveryOutside.Valid {
			p.DeliveryChargeOutside = &deliveryOutside.String
		}
		p.Images = []domain.ProductImage{}
		products = append(products, p)
		ids = append(ids, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if len(ids) > 0 {
		if err := r.attachImages(ctx, products, ids); err != nil {
			return nil, 0, err
		}
	}

	return products, total, nil
}

// ListPublicByShopSlug resolves a shop by slug (404 if missing or suspended),
// then delegates to ListByShop with is_active=true and is_archived=false forced.
func (r *productRepo) ListPublicByShopSlug(ctx context.Context, slug string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	var shopID string
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM shops WHERE slug = $1 AND is_suspended = false`,
		slug,
	).Scan(&shopID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, domain.ErrShopNotFound
	}
	if err != nil {
		return nil, 0, err
	}
	active := true
	archived := false
	filter.IsActive = &active
	filter.IsArchived = &archived
	return r.ListByShop(ctx, shopID, filter)
}

// attachImages fetches images for the given product IDs in one query and
// distributes them into each product's Images slice in sort_order.
func (r *productRepo) attachImages(ctx context.Context, products []*domain.Product, ids []string) error {
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

	byID := make(map[string]*domain.Product, len(products))
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

// --- Image operations ---

func (r *productRepo) AddImage(ctx context.Context, img *domain.ProductImage, shopID string) error {
	// Assert the product belongs to the shop via a subquery so a leaked image
	// insert cannot attach to a product the caller does not own.
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO product_images (product_id, url, sort_order)
		 SELECT p.id, $2, COALESCE(
		   (SELECT MAX(sort_order)+1 FROM product_images WHERE product_id = p.id), 0)
		 FROM products p
		 WHERE p.id = $1 AND p.shop_id = $3
		 RETURNING id, sort_order, created_at`,
		img.ProductID, img.URL, shopID,
	).Scan(&img.ID, &img.SortOrder, &img.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrProductNotFound
	}
	return err
}

func (r *productRepo) DeleteImage(ctx context.Context, imageID, productID, shopID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM product_images
		 WHERE id = $1
		   AND product_id = $2
		   AND product_id IN (SELECT id FROM products WHERE shop_id = $3)`,
		imageID, productID, shopID,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrProductNotFound
	}
	return nil
}

func (r *productRepo) ListImages(ctx context.Context, productID, shopID string) ([]*domain.ProductImage, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT i.id, i.product_id, i.url, i.sort_order, i.created_at
		 FROM product_images i
		 JOIN products p ON p.id = i.product_id
		 WHERE i.product_id = $1 AND p.shop_id = $2
		 ORDER BY i.sort_order ASC`,
		productID, shopID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.ProductImage, 0)
	for rows.Next() {
		img := &domain.ProductImage{}
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.SortOrder, &img.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

func (r *productRepo) CountImages(ctx context.Context, productID, shopID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*)
		 FROM product_images i
		 JOIN products p ON p.id = i.product_id
		 WHERE i.product_id = $1 AND p.shop_id = $2`,
		productID, shopID,
	).Scan(&n)
	return n, err
}

// ReorderImages sets sort_order for each provided image ID in one statement.
// Validation that the set matches exactly the product's images happens in the service.
func (r *productRepo) ReorderImages(ctx context.Context, productID, shopID string, imageIDs []string) error {
	if len(imageIDs) == 0 {
		return nil
	}
	// Build a VALUES list of (id, sort_order) rows and join-update.
	placeholders := make([]string, 0, len(imageIDs))
	args := make([]interface{}, 0, len(imageIDs)+2)
	args = append(args, productID, shopID)
	for i, id := range imageIDs {
		placeholders = append(placeholders, fmt.Sprintf("($%d::uuid, %d)", i+3, i))
		args = append(args, id)
	}
	query := fmt.Sprintf(`
		UPDATE product_images AS i
		SET sort_order = v.sort_order
		FROM (VALUES %s) AS v(id, sort_order)
		WHERE i.id = v.id
		  AND i.product_id = $1
		  AND i.product_id IN (SELECT id FROM products WHERE shop_id = $2)`,
		strings.Join(placeholders, ", "),
	)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// derefImages converts []*ProductImage to []ProductImage for embedding into Product.
func derefImages(imgs []*domain.ProductImage) []domain.ProductImage {
	out := make([]domain.ProductImage, len(imgs))
	for i, img := range imgs {
		out[i] = *img
	}
	return out
}
