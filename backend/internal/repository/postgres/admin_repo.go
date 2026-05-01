package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type adminRepo struct {
	db *sql.DB
}

// NewAdminRepo returns a postgres-backed AdminRepository.
func NewAdminRepo(db *sql.DB) repository.AdminRepository {
	return &adminRepo{db: db}
}

// PlatformStats aggregates counts across all tables for the overview page.
func (r *adminRepo) PlatformStats(ctx context.Context) (*domain.PlatformStats, error) {
	stats := &domain.PlatformStats{}
	err := r.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*) FROM shops),
			(SELECT COUNT(*) FROM shops WHERE is_suspended = false),
			(SELECT COUNT(*) FROM shops WHERE is_suspended = true),
			(SELECT COUNT(*) FROM users),
			(SELECT COUNT(*) FROM products WHERE is_archived = false),
			(SELECT COUNT(*) FROM orders),
			(SELECT COUNT(*) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date),
			(SELECT COALESCE(SUM(total_bdt), 0)::text FROM orders WHERE status != 'cancelled'),
			(SELECT COALESCE(SUM(total_bdt), 0)::text FROM orders WHERE status != 'cancelled' AND created_at >= now() - interval '30 days'),
			(SELECT COUNT(*) FROM shops WHERE created_at >= now() - interval '7 days'),
			(SELECT COUNT(*) FROM orders WHERE status = 'pending')
	`).Scan(
		&stats.TotalShops, &stats.ActiveShops, &stats.SuspendedShops,
		&stats.TotalUsers, &stats.TotalProducts,
		&stats.TotalOrders, &stats.OrdersToday,
		&stats.GMVAllTime, &stats.GMV30d,
		&stats.NewShops7d, &stats.PendingOrders,
	)
	if err != nil {
		return nil, fmt.Errorf("platform stats: %w", err)
	}
	return stats, nil
}

// ListShops returns paginated shops for the admin view.
// status: "" (all), "active", "suspended"; q matches shop name or slug.
func (r *adminRepo) ListShops(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminShopRow, int, error) {
	conditions := []string{"1=1"}
	args := []any{}
	argN := 1

	switch f.Status {
	case "active":
		conditions = append(conditions, "s.is_suspended = false")
	case "suspended":
		conditions = append(conditions, "s.is_suspended = true")
	}
	if f.Query != "" {
		conditions = append(conditions, fmt.Sprintf("(s.name ILIKE $%d OR s.slug ILIKE $%d)", argN, argN))
		args = append(args, "%"+f.Query+"%")
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM shops s WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin shops: %w", err)
	}

	listArgs := append(append([]any{}, args...), f.PageSize, f.Offset())
	query := fmt.Sprintf(`
		SELECT s.id, s.owner_user_id, s.slug, s.name, COALESCE(s.description,''),
		       COALESCE(s.logo_url,''), COALESCE(s.banner_url,''),
		       COALESCE(s.contact_phone,''), s.is_suspended, s.created_at, s.updated_at,
		       u.email,
		       (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.is_archived = false),
		       (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id),
		       (SELECT COALESCE(SUM(o.total_bdt),0)::text FROM orders o WHERE o.shop_id = s.id AND o.status != 'cancelled')
		FROM shops s
		JOIN users u ON u.id = s.owner_user_id
		WHERE %s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argN, argN+1)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list admin shops: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminShopRow, 0)
	for rows.Next() {
		row, err := scanAdminShopRowEnriched(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan admin shop: %w", err)
		}
		out = append(out, *row)
	}
	return out, total, rows.Err()
}

// SetShopSuspended flips the suspension flag.
func (r *adminRepo) SetShopSuspended(ctx context.Context, shopID string, suspended bool) error {
	res, err := r.db.ExecContext(ctx, `UPDATE shops SET is_suspended = $1 WHERE id = $2`, suspended, shopID)
	if err != nil {
		return fmt.Errorf("update shop suspension: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrShopNotFound
	}
	return nil
}

// ListUsers returns users for the admin users page.
// role: "" (all), "owner", "customer", "admin"; q matches email.
func (r *adminRepo) ListUsers(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminUserRow, int, error) {
	conditions := []string{"1=1"}
	args := []any{}
	argN := 1

	switch f.Role {
	case "owner":
		conditions = append(conditions, "EXISTS (SELECT 1 FROM shops s WHERE s.owner_user_id = u.id)")
	case "customer":
		conditions = append(conditions, "NOT EXISTS (SELECT 1 FROM shops s WHERE s.owner_user_id = u.id) AND u.is_admin = false")
	case "admin":
		conditions = append(conditions, "u.is_admin = true")
	}
	if f.Query != "" {
		conditions = append(conditions, fmt.Sprintf("u.email ILIKE $%d", argN))
		args = append(args, "%"+f.Query+"%")
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users u WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin users: %w", err)
	}

	listArgs := append(append([]any{}, args...), f.PageSize, f.Offset())
	query := fmt.Sprintf(`
		SELECT u.id, u.email, u.is_admin, u.created_at,
		       s.name, s.slug,
		       (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id),
		       (SELECT COALESCE(SUM(o.total_bdt),0)::text FROM orders o WHERE o.shop_id = s.id AND o.status != 'cancelled')
		FROM users u
		LEFT JOIN shops s ON s.owner_user_id = u.id
		WHERE %s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argN, argN+1)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list admin users: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminUserRow, 0)
	for rows.Next() {
		row := domain.AdminUserRow{}
		var shopName, shopSlug, spent sql.NullString
		var createdAt sql.NullTime
		if err := rows.Scan(&row.ID, &row.Email, &row.IsAdmin, &createdAt,
			&shopName, &shopSlug, &row.OrderCount, &spent); err != nil {
			return nil, 0, fmt.Errorf("scan admin user: %w", err)
		}
		row.IsOwner = shopName.Valid
		row.ShopName = shopName.String
		row.ShopSlug = shopSlug.String
		if createdAt.Valid {
			row.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		row.SpentBDT = "0"
		if spent.Valid {
			row.SpentBDT = spent.String
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// ListOrders returns cross-shop orders.
func (r *adminRepo) ListOrders(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminOrderRow, int, error) {
	conditions := []string{"1=1"}
	args := []any{}
	argN := 1

	if f.Status != "" {
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if f.Query != "" {
		conditions = append(conditions, fmt.Sprintf("(o.customer_name ILIKE $%d OR o.customer_phone ILIKE $%d OR s.name ILIKE $%d)", argN, argN, argN))
		args = append(args, "%"+f.Query+"%")
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM orders o JOIN shops s ON s.id = o.shop_id WHERE "+where, args...).
		Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin orders: %w", err)
	}

	listArgs := append(append([]any{}, args...), f.PageSize, f.Offset())
	query := fmt.Sprintf(`
		SELECT o.id, o.shop_id, s.name, s.slug,
		       o.customer_name, o.customer_phone, o.delivery_area,
		       o.total_bdt::text, o.status, o.created_at
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argN, argN+1)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list admin orders: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminOrderRow, 0)
	for rows.Next() {
		row := domain.AdminOrderRow{}
		var createdAt sql.NullTime
		if err := rows.Scan(&row.ID, &row.ShopID, &row.ShopName, &row.ShopSlug,
			&row.CustomerName, &row.CustomerPhone, &row.DeliveryArea,
			&row.TotalBDT, &row.Status, &createdAt); err != nil {
			return nil, 0, fmt.Errorf("scan admin order: %w", err)
		}
		if createdAt.Valid {
			row.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// ListProducts returns cross-shop products for moderation.
func (r *adminRepo) ListProducts(ctx context.Context, f domain.AdminListFilter) ([]domain.AdminProductRow, int, error) {
	conditions := []string{"p.is_archived = false"}
	args := []any{}
	argN := 1

	switch f.Status {
	case "live":
		conditions = append(conditions, "p.is_active = true")
	case "hidden":
		conditions = append(conditions, "p.is_active = false")
	}
	if f.Query != "" {
		conditions = append(conditions, fmt.Sprintf("(p.name ILIKE $%d OR s.name ILIKE $%d)", argN, argN))
		args = append(args, "%"+f.Query+"%")
		argN++
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM products p JOIN shops s ON s.id = p.shop_id WHERE "+where, args...).
		Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin products: %w", err)
	}

	listArgs := append(append([]any{}, args...), f.PageSize, f.Offset())
	query := fmt.Sprintf(`
		SELECT p.id, p.name, p.shop_id, s.name, s.slug,
		       p.price_bdt::text, p.stock, p.is_active, p.is_archived,
		       COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1), ''),
		       p.created_at
		FROM products p
		JOIN shops s ON s.id = p.shop_id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argN, argN+1)

	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list admin products: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminProductRow, 0)
	for rows.Next() {
		row := domain.AdminProductRow{}
		var createdAt sql.NullTime
		if err := rows.Scan(&row.ID, &row.Name, &row.ShopID, &row.ShopName, &row.ShopSlug,
			&row.PriceBDT, &row.Stock, &row.IsActive, &row.IsArchived,
			&row.ImageURL, &createdAt); err != nil {
			return nil, 0, fmt.Errorf("scan admin product: %w", err)
		}
		if createdAt.Valid {
			row.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// SetProductActive flips the visibility flag for a product (any shop).
func (r *adminRepo) SetProductActive(ctx context.Context, productID string, active bool) error {
	res, err := r.db.ExecContext(ctx, `UPDATE products SET is_active = $1 WHERE id = $2 AND is_archived = false`, active, productID)
	if err != nil {
		return fmt.Errorf("update product active: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrProductNotFound
	}
	return nil
}

// RecentShops returns the N newest shops for the overview "new shops" widget.
func (r *adminRepo) RecentShops(ctx context.Context, limit int) ([]domain.AdminShopRow, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT s.id, s.owner_user_id, s.slug, s.name, COALESCE(s.description,''),
		       COALESCE(s.logo_url,''), COALESCE(s.banner_url,''),
		       COALESCE(s.contact_phone,''), s.is_suspended, s.created_at, s.updated_at,
		       u.email
		FROM shops s
		JOIN users u ON u.id = s.owner_user_id
		ORDER BY s.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("recent shops: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminShopRow, 0)
	for rows.Next() {
		row := domain.AdminShopRow{}
		if err := rows.Scan(
			&row.ID, &row.OwnerUserID, &row.Slug, &row.Name, &row.Description,
			&row.LogoURL, &row.BannerURL, &row.ContactPhone, &row.IsSuspended,
			&row.CreatedAt, &row.UpdatedAt, &row.OwnerEmail,
		); err != nil {
			return nil, fmt.Errorf("scan recent shop: %w", err)
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// TopShops returns the top shops by order count over the given window in days.
func (r *adminRepo) TopShops(ctx context.Context, days, limit int) ([]domain.AdminShopRow, error) {
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT s.id, s.owner_user_id, s.slug, s.name, COALESCE(s.description,''),
		       COALESCE(s.logo_url,''), COALESCE(s.banner_url,''),
		       COALESCE(s.contact_phone,''), s.is_suspended, s.created_at, s.updated_at,
		       u.email,
		       (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.is_archived = false),
		       COALESCE(o_stats.order_count, 0),
		       COALESCE(o_stats.revenue_bdt, '0')
		FROM shops s
		JOIN users u ON u.id = s.owner_user_id
		LEFT JOIN (
			SELECT shop_id,
			       COUNT(*)::int AS order_count,
			       COALESCE(SUM(total_bdt),0)::text AS revenue_bdt
			FROM orders
			WHERE status != 'cancelled' AND created_at >= now() - interval '%d days'
			GROUP BY shop_id
		) o_stats ON o_stats.shop_id = s.id
		WHERE s.is_suspended = false
		ORDER BY COALESCE(o_stats.order_count, 0) DESC, s.created_at DESC
		LIMIT $1`, days), limit)
	if err != nil {
		return nil, fmt.Errorf("top shops: %w", err)
	}
	defer rows.Close()

	out := make([]domain.AdminShopRow, 0)
	for rows.Next() {
		row, err := scanAdminShopRowEnriched(rows)
		if err != nil {
			return nil, fmt.Errorf("scan top shop: %w", err)
		}
		out = append(out, *row)
	}
	return out, rows.Err()
}

// ShopByID returns one shop with admin-enriched fields.
func (r *adminRepo) ShopByID(ctx context.Context, shopID string) (*domain.AdminShopRow, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT s.id, s.owner_user_id, s.slug, s.name, COALESCE(s.description,''),
		       COALESCE(s.logo_url,''), COALESCE(s.banner_url,''),
		       COALESCE(s.contact_phone,''), s.is_suspended, s.created_at, s.updated_at,
		       u.email,
		       (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.is_archived = false),
		       (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id),
		       (SELECT COALESCE(SUM(o.total_bdt),0)::text FROM orders o WHERE o.shop_id = s.id AND o.status != 'cancelled')
		FROM shops s
		JOIN users u ON u.id = s.owner_user_id
		WHERE s.id = $1`, shopID)

	out, err := scanAdminShopRowEnriched(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrShopNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("admin shop by id: %w", err)
	}
	return out, nil
}

// scanAdminShopRowEnriched scans the full enriched-shop projection
// (used by ListShops, TopShops, ShopByID).
func scanAdminShopRowEnriched(s interface{ Scan(...any) error }) (*domain.AdminShopRow, error) {
	row := &domain.AdminShopRow{}
	if err := s.Scan(
		&row.ID, &row.OwnerUserID, &row.Slug, &row.Name, &row.Description,
		&row.LogoURL, &row.BannerURL, &row.ContactPhone, &row.IsSuspended,
		&row.CreatedAt, &row.UpdatedAt, &row.OwnerEmail,
		&row.ProductCount, &row.OrderCount, &row.RevenueBDT,
	); err != nil {
		return nil, err
	}
	return row, nil
}
