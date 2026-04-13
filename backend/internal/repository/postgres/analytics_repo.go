package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type analyticsRepo struct {
	db *sql.DB
}

func NewAnalyticsRepo(db *sql.DB) repository.AnalyticsRepository {
	return &analyticsRepo{db: db}
}

func (r *analyticsRepo) TodayStats(ctx context.Context, shopID string) (*domain.TodayStats, error) {
	today := time.Now().Format("2006-01-02")

	row := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)                                          AS total_orders,
			COUNT(*) FILTER (WHERE status = 'pending')        AS pending_orders,
			COALESCE(SUM(total_bdt) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue_bdt
		FROM orders
		WHERE shop_id = $1
		  AND created_at::date = $2::date`, shopID, today)

	s := &domain.TodayStats{Date: today}
	if err := row.Scan(&s.TotalOrders, &s.PendingOrders, &s.RevenueBDT); err != nil {
		return nil, fmt.Errorf("today stats: %w", err)
	}
	return s, nil
}

func (r *analyticsRepo) RangeStats(ctx context.Context, shopID string, from, to time.Time) ([]domain.DayStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			d::date                                                          AS date,
			COUNT(o.id)                                                      AS orders,
			COALESCE(SUM(o.total_bdt) FILTER (WHERE o.status NOT IN ('cancelled')), 0) AS revenue_bdt
		FROM generate_series($2::date, $3::date, '1 day') AS d
		LEFT JOIN orders o
			ON o.shop_id = $1
			AND o.created_at::date = d::date
		GROUP BY d::date
		ORDER BY d::date`,
		shopID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("range stats query: %w", err)
	}
	defer rows.Close()

	var stats []domain.DayStat
	for rows.Next() {
		var ds domain.DayStat
		var date time.Time
		if err := rows.Scan(&date, &ds.Orders, &ds.RevenueBDT); err != nil {
			return nil, fmt.Errorf("range stats scan: %w", err)
		}
		ds.Date = date.Format("2006-01-02")
		stats = append(stats, ds)
	}
	if stats == nil {
		stats = []domain.DayStat{}
	}
	return stats, nil
}

func (r *analyticsRepo) TopProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error) {
	// Current calendar month.
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			oi.product_id,
			oi.product_name_snapshot                          AS product_name,
			SUM(oi.quantity)                                  AS total_quantity,
			SUM(oi.line_total_bdt)                            AS total_revenue_bdt
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.shop_id = $1
		  AND o.status NOT IN ('cancelled')
		  AND o.created_at::date >= $2::date
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY total_quantity DESC
		LIMIT $3`,
		shopID, monthStart, limit)
	if err != nil {
		return nil, fmt.Errorf("top products query: %w", err)
	}
	defer rows.Close()

	var products []domain.TopProduct
	for rows.Next() {
		var tp domain.TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQuantity, &tp.TotalRevenueBDT); err != nil {
			return nil, fmt.Errorf("top products scan: %w", err)
		}
		products = append(products, tp)
	}
	if products == nil {
		products = []domain.TopProduct{}
	}
	return products, nil
}

// PopularProducts returns top-selling products (public — no revenue data leaked).
func (r *analyticsRepo) PopularProducts(ctx context.Context, shopID string, limit int) ([]domain.TopProduct, error) {
	// Last 30 days.
	since := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			oi.product_id,
			oi.product_name_snapshot                          AS product_name,
			SUM(oi.quantity)                                  AS total_quantity
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.shop_id = $1
		  AND o.status NOT IN ('cancelled')
		  AND o.created_at::date >= $2::date
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY total_quantity DESC
		LIMIT $3`,
		shopID, since, limit)
	if err != nil {
		return nil, fmt.Errorf("popular products query: %w", err)
	}
	defer rows.Close()

	var products []domain.TopProduct
	for rows.Next() {
		var tp domain.TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQuantity); err != nil {
			return nil, fmt.Errorf("popular products scan: %w", err)
		}
		products = append(products, tp)
	}
	if products == nil {
		products = []domain.TopProduct{}
	}
	return products, nil
}
