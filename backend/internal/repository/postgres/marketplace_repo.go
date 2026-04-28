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
	orderBy := "p.created_at DESC"

	if filter.Query != "" {
		ilike := "%" + filter.Query + "%"
		// Layer 1 – FTS via generated search_vector (exact + stemmed, uses GIN index).
		// Layer 2 – per-token word_similarity: splits the query on spaces and checks whether
		//   ANY token fuzzy-matches a segment of the name (threshold 0.4). This handles
		//   multi-word queries like "riyad jarsey" where the combined score drops to 0.37
		//   (misses) but the "jarsey" token alone scores 0.43 (hits). $argN reused across FTS,
		//   unnest, and ORDER BY — lib/pq supports multi-use of the same positional param.
		// Layer 3 – ILIKE for short terms (<3 chars) where trigrams don't score.
		conditions = append(conditions, fmt.Sprintf(
			`(p.search_vector @@ plainto_tsquery('simple', $%[1]d)
			  OR EXISTS (
			    SELECT 1 FROM unnest(string_to_array(trim($%[1]d), ' ')) AS q_word
			    WHERE length(q_word) >= 2 AND word_similarity(q_word, p.name) > 0.4
			  )
			  OR p.name ILIKE $%[2]d)`,
			argN, argN+1,
		))
		args = append(args, filter.Query, ilike)
		// FTS rank wins first; best per-token word_similarity breaks ties; newest last resort.
		orderBy = fmt.Sprintf(
			`ts_rank(p.search_vector, plainto_tsquery('simple', $%[1]d)) DESC,
			 (SELECT COALESCE(MAX(word_similarity(q_word, p.name)), 0)
			  FROM unnest(string_to_array(trim($%[1]d), ' ')) AS q_word
			  WHERE length(q_word) >= 2) DESC,
			 p.created_at DESC`,
			argN,
		)
		argN += 2
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
		        p.discount_type, p.discount_value::text,
		        p.delivery_charge_dhaka::text, p.delivery_charge_outside::text,
		        p.created_at, p.updated_at,
		        s.name, s.slug, COALESCE(s.logo_url, '')
		 %s
		 WHERE %s
		 ORDER BY %s
		 LIMIT $%d OFFSET $%d`,
		joinClause, where, orderBy, argN, argN+1,
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
		var categoryID, description, discountType, discountValue, deliveryDhaka, deliveryOutside sql.NullString
		if err := rows.Scan(
			&mp.ID, &mp.ShopID, &categoryID, &mp.Name, &description, &mp.PriceBDT,
			&mp.Stock, &mp.IsActive, &mp.IsArchived,
			&discountType, &discountValue, &deliveryDhaka, &deliveryOutside,
			&mp.CreatedAt, &mp.UpdatedAt,
			&mp.ShopName, &mp.ShopSlug, &mp.ShopLogoURL,
		); err != nil {
			return nil, 0, fmt.Errorf("marketplace scan: %w", err)
		}
		if categoryID.Valid {
			mp.CategoryID = &categoryID.String
		}
		mp.Description = description.String
		if discountType.Valid {
			mp.DiscountType = &discountType.String
		}
		if discountValue.Valid {
			mp.DiscountValue = &discountValue.String
		}
		if deliveryDhaka.Valid {
			mp.DeliveryChargeDhaka = &deliveryDhaka.String
		}
		if deliveryOutside.Valid {
			mp.DeliveryChargeOutside = &deliveryOutside.String
		}
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
	conditions := []string{"s.is_suspended = false"}
	args := []interface{}{}
	argN := 1
	orderBy := "s.created_at DESC"

	if query != "" {
		ilike := "%" + query + "%"
		conditions = append(conditions, fmt.Sprintf(
			`(s.search_vector @@ plainto_tsquery('simple', $%[1]d)
			  OR EXISTS (
			    SELECT 1 FROM unnest(string_to_array(trim($%[1]d), ' ')) AS q_word
			    WHERE length(q_word) >= 2 AND word_similarity(q_word, s.name) > 0.4
			  )
			  OR s.name ILIKE $%[2]d)`,
			argN, argN+1,
		))
		args = append(args, query, ilike)
		orderBy = fmt.Sprintf(
			`ts_rank(s.search_vector, plainto_tsquery('simple', $%[1]d)) DESC,
			 (SELECT COALESCE(MAX(word_similarity(q_word, s.name)), 0)
			  FROM unnest(string_to_array(trim($%[1]d), ' ')) AS q_word
			  WHERE length(q_word) >= 2) DESC,
			 s.created_at DESC`,
			argN,
		)
		argN += 2
	}

	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM shops s WHERE "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("marketplace shops count: %w", err)
	}

	listArgs := append(append([]interface{}{}, args...), limit, offset)
	q := fmt.Sprintf(
		`SELECT s.id, s.owner_user_id, s.slug, s.name, COALESCE(s.description,''),
		        COALESCE(s.logo_url,''), COALESCE(s.banner_url,''),
		        COALESCE(s.contact_phone,''), s.is_suspended, s.created_at, s.updated_at,
		        COALESCE(r.avg_rating, 0)::float, COALESCE(r.review_count, 0)
		 FROM shops s
		 LEFT JOIN (
		   SELECT shop_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
		   FROM product_reviews
		   GROUP BY shop_id
		 ) r ON r.shop_id = s.id
		 WHERE %s
		 ORDER BY %s
		 LIMIT $%d OFFSET $%d`,
		where, orderBy, argN, argN+1,
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
			&s.RatingAverage, &s.RatingCount,
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
