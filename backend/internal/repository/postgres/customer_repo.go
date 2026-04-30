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

type customerRepo struct {
	db *sql.DB
}

func NewCustomerRepo(db *sql.DB) repository.CustomerRepository {
	return &customerRepo{db: db}
}

// Segment thresholds. VIP triggers on either spend or order count, whichever
// the seller hits first. Inactive is a recency rule independent of value.
const (
	vipMinSpentBDT     = 10000
	vipMinOrders       = 5
	inactiveAfterDays  = 90
	newWithinDays      = 30
	defaultListLimit   = 50
	maxListLimit       = 200
	maxNoteLength      = 1000
)

// segmentExpr is the canonical CASE used in every customer-aggregation query.
// Kept inline (not a SQL function) so query plans stay readable.
const segmentExpr = `
    CASE
        WHEN total_spent >= ` + "10000" + ` OR total_orders >= 5 THEN 'vip'
        WHEN last_order_at < (now() - interval '90 days') THEN 'inactive'
        WHEN total_orders >= 2 THEN 'returning'
        ELSE 'new'
    END`

// baseAggregateCTE produces the per-customer aggregate CTE shared across
// queries. Note: cancelled orders are excluded from totals/spend but still
// affect "name to display" via the latest-order pick — that's intentional
// because the seller's last interaction with the buyer matters even if
// cancelled.
const baseAggregateCTE = `
WITH agg AS (
    SELECT
        normalize_phone(customer_phone) AS phone_key,
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled'))                 AS total_orders,
        COALESCE(SUM(total_bdt) FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_spent,
        MIN(created_at) FILTER (WHERE status NOT IN ('cancelled'))          AS first_order_at,
        MAX(created_at) FILTER (WHERE status NOT IN ('cancelled'))          AS last_order_at
    FROM orders
    WHERE shop_id = $1
    GROUP BY normalize_phone(customer_phone)
    HAVING COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) > 0
),
latest AS (
    SELECT DISTINCT ON (normalize_phone(customer_phone))
        normalize_phone(customer_phone) AS phone_key,
        customer_name,
        customer_phone,
        delivery_area
    FROM orders
    WHERE shop_id = $1
      AND status NOT IN ('cancelled')
    ORDER BY normalize_phone(customer_phone), created_at DESC
)`

func (r *customerRepo) List(ctx context.Context, shopID string, f domain.CustomerListFilters) ([]domain.Customer, int, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	args := []any{shopID}
	whereClauses := []string{}
	addArg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.Segment != "" {
		whereClauses = append(whereClauses, "segment = "+addArg(string(f.Segment)))
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		pattern := "%" + s + "%"
		whereClauses = append(whereClauses, "(l.customer_name ILIKE "+addArg(pattern)+" OR l.customer_phone ILIKE "+addArg(pattern)+")")
	}

	where := ""
	if len(whereClauses) > 0 {
		where = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	orderBy := "ORDER BY a.last_order_at DESC NULLS LAST"
	switch f.Sort {
	case "orders":
		orderBy = "ORDER BY a.total_orders DESC, a.last_order_at DESC NULLS LAST"
	case "spent":
		orderBy = "ORDER BY a.total_spent DESC, a.last_order_at DESC NULLS LAST"
	case "name":
		orderBy = "ORDER BY l.customer_name ASC"
	}

	limitArg := addArg(limit)
	offsetArg := addArg(offset)

	query := baseAggregateCTE + `
        SELECT
            a.phone_key,
            l.customer_name,
            l.customer_phone,
            COALESCE(l.delivery_area, ''),
            a.total_orders,
            a.total_spent::text,
            CASE WHEN a.total_orders > 0 THEN (a.total_spent / a.total_orders)::text ELSE '0' END AS avg_order,
            a.first_order_at,
            a.last_order_at,` + segmentExpr + ` AS segment,
            COALESCE(n.note, '') AS note,
            n.updated_at AS note_updated_at,
            COUNT(*) OVER () AS total_count
        FROM agg a
        JOIN latest l USING (phone_key)
        LEFT JOIN customer_notes n ON n.shop_id = $1 AND n.customer_phone = a.phone_key
        ` + where + `
        ` + orderBy + `
        LIMIT ` + limitArg + ` OFFSET ` + offsetArg

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("customer list query: %w", err)
	}
	defer rows.Close()

	customers := []domain.Customer{}
	total := 0
	for rows.Next() {
		var c domain.Customer
		var segment string
		if err := rows.Scan(
			&c.NormalizedPhone,
			&c.Name,
			&c.DisplayPhone,
			&c.DeliveryArea,
			&c.TotalOrders,
			&c.TotalSpentBDT,
			&c.AvgOrderBDT,
			&c.FirstOrderAt,
			&c.LastOrderAt,
			&segment,
			&c.Note,
			&c.NoteUpdatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("customer list scan: %w", err)
		}
		c.Segment = domain.CustomerSegment(segment)
		customers = append(customers, c)
	}
	return customers, total, rows.Err()
}

func (r *customerRepo) Get(ctx context.Context, shopID, normalizedPhone string) (*domain.Customer, error) {
	query := baseAggregateCTE + `
        SELECT
            a.phone_key,
            l.customer_name,
            l.customer_phone,
            COALESCE(l.delivery_area, ''),
            a.total_orders,
            a.total_spent::text,
            CASE WHEN a.total_orders > 0 THEN (a.total_spent / a.total_orders)::text ELSE '0' END AS avg_order,
            a.first_order_at,
            a.last_order_at,` + segmentExpr + ` AS segment,
            COALESCE(n.note, '') AS note,
            n.updated_at AS note_updated_at
        FROM agg a
        JOIN latest l USING (phone_key)
        LEFT JOIN customer_notes n ON n.shop_id = $1 AND n.customer_phone = a.phone_key
        WHERE a.phone_key = $2`

	c := &domain.Customer{}
	var segment string
	err := r.db.QueryRowContext(ctx, query, shopID, normalizedPhone).Scan(
		&c.NormalizedPhone,
		&c.Name,
		&c.DisplayPhone,
		&c.DeliveryArea,
		&c.TotalOrders,
		&c.TotalSpentBDT,
		&c.AvgOrderBDT,
		&c.FirstOrderAt,
		&c.LastOrderAt,
		&segment,
		&c.Note,
		&c.NoteUpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrCustomerNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get customer: %w", err)
	}
	c.Segment = domain.CustomerSegment(segment)
	return c, nil
}

func (r *customerRepo) Orders(ctx context.Context, shopID, normalizedPhone string) ([]domain.CustomerOrderSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
        SELECT
            o.id,
            o.total_bdt::text,
            o.status,
            COALESCE(item_counts.cnt, 0)               AS items_count,
            o.created_at
        FROM orders o
        LEFT JOIN (
            SELECT order_id, COUNT(*) AS cnt FROM order_items GROUP BY order_id
        ) item_counts ON item_counts.order_id = o.id
        WHERE o.shop_id = $1
          AND normalize_phone(o.customer_phone) = $2
        ORDER BY o.created_at DESC`,
		shopID, normalizedPhone)
	if err != nil {
		return nil, fmt.Errorf("customer orders query: %w", err)
	}
	defer rows.Close()

	out := []domain.CustomerOrderSummary{}
	for rows.Next() {
		var o domain.CustomerOrderSummary
		if err := rows.Scan(&o.OrderID, &o.TotalBDT, &o.Status, &o.ItemsCount, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("customer orders scan: %w", err)
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (r *customerRepo) UpsertNote(ctx context.Context, shopID, normalizedPhone, note string) error {
	if len(note) > maxNoteLength {
		note = note[:maxNoteLength]
	}
	_, err := r.db.ExecContext(ctx, `
        INSERT INTO customer_notes (shop_id, customer_phone, note)
        VALUES ($1, $2, $3)
        ON CONFLICT (shop_id, customer_phone) DO UPDATE
            SET note = EXCLUDED.note, updated_at = now()`,
		shopID, normalizedPhone, note)
	if err != nil {
		return fmt.Errorf("upsert customer note: %w", err)
	}
	return nil
}

func (r *customerRepo) DeleteNote(ctx context.Context, shopID, normalizedPhone string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM customer_notes WHERE shop_id = $1 AND customer_phone = $2`,
		shopID, normalizedPhone)
	if err != nil {
		return fmt.Errorf("delete customer note: %w", err)
	}
	return nil
}

func (r *customerRepo) Analytics(ctx context.Context, shopID string) (*domain.CustomerAnalytics, error) {
	query := baseAggregateCTE + `,
        with_segment AS (
            SELECT
                a.phone_key,
                a.total_orders,
                a.total_spent,
                a.first_order_at,
                a.last_order_at,` + segmentExpr + ` AS segment
            FROM agg a
        )
        SELECT
            COUNT(*)                                                 AS total_customers,
            COUNT(*) FILTER (WHERE segment = 'new')                  AS new_count,
            COUNT(*) FILTER (WHERE segment = 'returning')            AS returning_count,
            COUNT(*) FILTER (WHERE segment = 'vip')                  AS vip_count,
            COUNT(*) FILTER (WHERE segment = 'inactive')             AS inactive_count,
            COALESCE(AVG(total_spent), 0)::text                      AS avg_lifetime,
            COALESCE(SUM(total_spent), 0)::text                      AS total_lifetime,
            CASE
                WHEN COUNT(*) > 0 THEN
                    ((COUNT(*) FILTER (WHERE total_orders >= 2))::numeric / COUNT(*)::numeric * 100)::numeric(10,2)::text
                ELSE '0'
            END                                                      AS repeat_rate
        FROM with_segment`

	a := &domain.CustomerAnalytics{}
	err := r.db.QueryRowContext(ctx, query, shopID).Scan(
		&a.TotalCustomers,
		&a.NewCount,
		&a.ReturningCount,
		&a.VIPCount,
		&a.InactiveCount,
		&a.AvgLifetimeBDT,
		&a.TotalLifetimeBDT,
		&a.RepeatPurchaseRate,
	)
	if err != nil {
		return nil, fmt.Errorf("customer analytics: %w", err)
	}
	return a, nil
}
