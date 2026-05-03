package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type orderRepo struct {
	db *sql.DB
}

func NewOrderRepo(db *sql.DB) repository.OrderRepository {
	return &orderRepo{db: db}
}

// orderColumns is the shared SELECT list for order queries.
const orderColumns = `o.id, o.shop_id, o.customer_name, o.customer_phone, o.delivery_address,
	COALESCE(o.delivery_division, ''), COALESCE(o.delivery_district, ''),
	COALESCE(o.delivery_area, ''), COALESCE(o.note, ''), o.subtotal_bdt, o.delivery_charge_bdt,
	o.total_bdt, o.status, o.advance_payment_required,
	o.advance_payment_received, o.cancelled_reason, o.created_at, o.updated_at`

// scanOrder scans a row into a domain.Order matching orderColumns.
func scanOrder(scanner interface{ Scan(...any) error }) (*domain.Order, error) {
	o := &domain.Order{}
	err := scanner.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone, &o.DeliveryAddress,
		&o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note, &o.SubtotalBDT, &o.DeliveryChargeBDT,
		&o.TotalBDT, &o.Status, &o.AdvancePaymentRequired,
		&o.AdvancePaymentReceived, &o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	return o, err
}

// PlaceOrder inserts the order header and items, decrementing product stock
// atomically in a single transaction. If any product lacks sufficient stock
// the whole transaction rolls back.
func (r *orderRepo) PlaceOrder(ctx context.Context, order *domain.Order) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Insert order header.
	err = tx.QueryRowContext(ctx,
		`INSERT INTO orders
		   (shop_id, customer_name, customer_phone, delivery_address,
		    delivery_division, delivery_district, delivery_area,
		    note, subtotal_bdt, delivery_charge_bdt, total_bdt, advance_payment_required)
		 VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),$9::numeric,$10::numeric,$11::numeric,$12)
		 RETURNING id, status, advance_payment_received, created_at, updated_at`,
		order.ShopID, order.CustomerName, order.CustomerPhone, order.DeliveryAddress,
		order.DeliveryDivision, order.DeliveryDistrict, order.DeliveryArea,
		order.Note, order.SubtotalBDT, order.DeliveryChargeBDT,
		order.TotalBDT, order.AdvancePaymentRequired,
	).Scan(&order.ID, &order.Status, &order.AdvancePaymentReceived, &order.CreatedAt, &order.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert order: %w", err)
	}

	// Insert items and decrement stock in one pass.
	for i := range order.Items {
		item := &order.Items[i]

		// Decrement stock — the CHECK (stock >= 0) constraint on the products
		// table guarantees we can't go negative. If it does, Postgres returns
		// a check violation error.
		res, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = stock - $1
			 WHERE id = $2 AND shop_id = $3 AND is_active = true AND is_archived = false`,
			item.Quantity, item.ProductID, order.ShopID,
		)
		if err != nil {
			return domain.ErrInsufficientStock
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			return domain.ErrProductNotFound
		}

		err = tx.QueryRowContext(ctx,
			`INSERT INTO order_items
			   (order_id, product_id, product_name_snapshot,
			    unit_price_snapshot_bdt, quantity, line_total_bdt)
			 VALUES ($1, $2, $3, $4::numeric, $5, $6::numeric)
			 RETURNING id`,
			order.ID, item.ProductID, item.ProductNameSnapshot,
			item.UnitPriceSnapshotBDT, item.Quantity, item.LineTotalBDT,
		).Scan(&item.ID)
		if err != nil {
			return fmt.Errorf("insert order item: %w", err)
		}
		item.OrderID = order.ID
	}

	return tx.Commit()
}

func (r *orderRepo) OrderListByShopOwner(ctx context.Context, ownerUserID string, status, phone string, limit, offset int) ([]*domain.Order, error) {
	query := `SELECT ` + orderColumns + `
		 FROM orders o
		 JOIN shops s ON s.id = o.shop_id
		 WHERE s.owner_user_id = $1`
	args := []any{ownerUserID}
	idx := 2

	if status != "" {
		query += fmt.Sprintf(` AND o.status = $%d`, idx)
		args = append(args, status)
		idx++
	}
	if phone != "" {
		query += fmt.Sprintf(` AND o.customer_phone = $%d`, idx)
		args = append(args, phone)
		idx++
	}

	query += ` ORDER BY o.created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query orders: %w", err)
	}
	defer rows.Close()

	var orders []*domain.Order
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, fmt.Errorf("scan order: %w", err)
		}
		orders = append(orders, o)
	}

	return orders, nil
}

func (r *orderRepo) OrderByIDForShopOwner(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT `+orderColumns+`
		 FROM orders o
		 JOIN shops s ON s.id = o.shop_id
		 WHERE s.owner_user_id = $1 AND o.id = $2`,
		ownerUserID, orderID,
	)
	o, err := scanOrder(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("query order: %w", err)
	}
	return o, nil
}

// UpdateOrderStatusForShopOwner updates order status. When cancelling,
// stock is restored in the same transaction.
func (r *orderRepo) UpdateOrderStatusForShopOwner(ctx context.Context, ownerUserID, orderID, status string, cancelledReason *string) (*domain.Order, error) {
	log.Println(status)
	if status == "cancelled" {
		return r.cancelWithStockRestore(ctx, ownerUserID, orderID, cancelledReason)
	}

	row := r.db.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = $1, cancelled_reason = $2
		 FROM shops
		 WHERE shops.id = orders.shop_id
		   AND shops.owner_user_id = $3
		   AND orders.id = $4
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, COALESCE(orders.delivery_division, ''), COALESCE(orders.delivery_district, ''),
		   COALESCE(orders.delivery_area, ''), COALESCE(orders.note, ''),
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		status, cancelledReason, ownerUserID, orderID,
	)

	o := &domain.Order{}
	err := row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note,
		&o.SubtotalBDT, &o.DeliveryChargeBDT, &o.TotalBDT,
		&o.Status, &o.AdvancePaymentRequired, &o.AdvancePaymentReceived,
		&o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("update order status: %w", err)
	}
	return o, nil
}

// cancelWithStockRestore cancels an order and restores stock in one transaction.
func (r *orderRepo) cancelWithStockRestore(ctx context.Context, ownerUserID, orderID string, cancelledReason *string) (*domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Update order status to cancelled.
	row := tx.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = 'cancelled', cancelled_reason = $1
		 FROM shops
		 WHERE shops.id = orders.shop_id
		   AND shops.owner_user_id = $2
		   AND orders.id = $3
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, COALESCE(orders.delivery_division, ''), COALESCE(orders.delivery_district, ''),
		   COALESCE(orders.delivery_area, ''), COALESCE(orders.note, ''),
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		cancelledReason, ownerUserID, orderID,
	)

	o := &domain.Order{}
	err = row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note,
		&o.SubtotalBDT, &o.DeliveryChargeBDT, &o.TotalBDT,
		&o.Status, &o.AdvancePaymentRequired, &o.AdvancePaymentReceived,
		&o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("cancel order: %w", err)
	}

	// Restore stock for each item.
	_, err = tx.ExecContext(ctx,
		`UPDATE products
		 SET stock = products.stock + oi.quantity
		 FROM order_items oi
		 WHERE oi.order_id = $1
		   AND products.id = oi.product_id`,
		orderID,
	)
	if err != nil {
		return nil, fmt.Errorf("restore stock: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return o, nil
}

// RestoreCancelledOrder reverses a cancellation: sets status back to pending,
// clears cancelled_reason, and re-decrements product stock in one transaction.
// The CHECK (stock >= 0) constraint surfaces ErrInsufficientStock if the
// products were sold to other orders in the meantime.
func (r *orderRepo) RestoreCancelledOrder(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = 'pending', cancelled_reason = NULL
		 FROM shops
		 WHERE shops.id = orders.shop_id
		   AND shops.owner_user_id = $1
		   AND orders.id = $2
		   AND orders.status = 'cancelled'
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, COALESCE(orders.delivery_division, ''), COALESCE(orders.delivery_district, ''),
		   COALESCE(orders.delivery_area, ''), COALESCE(orders.note, ''),
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		ownerUserID, orderID,
	)

	o := &domain.Order{}
	err = row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note,
		&o.SubtotalBDT, &o.DeliveryChargeBDT, &o.TotalBDT,
		&o.Status, &o.AdvancePaymentRequired, &o.AdvancePaymentReceived,
		&o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("restore cancelled order: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE products
		 SET stock = products.stock - oi.quantity
		 FROM order_items oi
		 WHERE oi.order_id = $1
		   AND products.id = oi.product_id`,
		orderID,
	)
	if err != nil {
		return nil, domain.ErrInsufficientStock
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return o, nil
}

// CancelOrderByBuyer cancels a pending order and restores stock.
func (r *orderRepo) CancelOrderByBuyer(ctx context.Context, shopID, orderID, customerPhone, cancelledReason string) (*domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = 'cancelled', cancelled_reason = $1
		 WHERE shop_id = $2
		   AND id::text LIKE lower($3) || '%'
		   AND customer_phone = $4
		   AND status = 'pending'
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, COALESCE(orders.delivery_division, ''), COALESCE(orders.delivery_district, ''),
		   COALESCE(orders.delivery_area, ''), COALESCE(orders.note, ''),
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		cancelledReason, shopID, orderID, customerPhone,
	)

	o := &domain.Order{}
	err = row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note,
		&o.SubtotalBDT, &o.DeliveryChargeBDT, &o.TotalBDT,
		&o.Status, &o.AdvancePaymentRequired, &o.AdvancePaymentReceived,
		&o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("cancel order by buyer: %w", err)
	}

	// Restore stock for each item.
	_, err = tx.ExecContext(ctx,
		`UPDATE products
		 SET stock = products.stock + oi.quantity
		 FROM order_items oi
		 WHERE oi.order_id = $1
		   AND products.id = oi.product_id`,
		orderID,
	)
	if err != nil {
		return nil, fmt.Errorf("restore stock: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return o, nil
}

// MarkAdvanceReceived sets advance_payment_received = true.
func (r *orderRepo) MarkAdvanceReceived(ctx context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	row := r.db.QueryRowContext(ctx,
		`UPDATE orders
		 SET advance_payment_received = true
		 FROM shops
		 WHERE shops.id = orders.shop_id
		   AND shops.owner_user_id = $1
		   AND orders.id = $2
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, COALESCE(orders.delivery_division, ''), COALESCE(orders.delivery_district, ''),
		   COALESCE(orders.delivery_area, ''), COALESCE(orders.note, ''),
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		ownerUserID, orderID,
	)

	o := &domain.Order{}
	err := row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryDivision, &o.DeliveryDistrict, &o.DeliveryArea, &o.Note,
		&o.SubtotalBDT, &o.DeliveryChargeBDT, &o.TotalBDT,
		&o.Status, &o.AdvancePaymentRequired, &o.AdvancePaymentReceived,
		&o.CancelledReason, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("mark advance received: %w", err)
	}
	return o, nil
}

// FindByIDAndPhone returns an order for customer lookup (by shop + order ID + phone).
// Accepts both full UUIDs and short prefixes (e.g. first 8 hex chars shown to customers).
func (r *orderRepo) FindByIDAndPhone(ctx context.Context, shopID, orderID, customerPhone string) (*domain.Order, error) {
	log.Printf("Finding order by shopID=%s, orderID=%s, customerPhone=%s", shopID, orderID, customerPhone)
	row := r.db.QueryRowContext(ctx,
		`SELECT `+orderColumns+`
		 FROM orders o
		 WHERE o.shop_id = $1
		   AND o.id::text LIKE lower($2) || '%'
		   AND o.customer_phone = $3`,
		shopID,
		orderID,
		customerPhone,
	)
	o, err := scanOrder(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.ErrOrderNotFound
		}
		return nil, fmt.Errorf("find order by id and phone: %w", err)
	}
	return o, nil
}

// LoadItems fetches order_items for the given orders and attaches them.
func (r *orderRepo) LoadItems(ctx context.Context, orders ...*domain.Order) error {
	if len(orders) == 0 {
		return nil
	}

	// Build IN clause.
	ids := make([]string, len(orders))
	args := make([]any, len(orders))
	for i, o := range orders {
		ids[i] = fmt.Sprintf("$%d", i+1)
		args[i] = o.ID
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, order_id, product_id, product_name_snapshot,
		        unit_price_snapshot_bdt, quantity, line_total_bdt
		 FROM order_items
		 WHERE order_id IN (`+strings.Join(ids, ",")+`)
		 ORDER BY created_at`,
		args...,
	)
	if err != nil {
		return fmt.Errorf("load order items: %w", err)
	}
	defer rows.Close()

	byOrder := make(map[string][]domain.OrderItem)
	for rows.Next() {
		var it domain.OrderItem
		if err := rows.Scan(&it.ID, &it.OrderID, &it.ProductID,
			&it.ProductNameSnapshot, &it.UnitPriceSnapshotBDT,
			&it.Quantity, &it.LineTotalBDT); err != nil {
			return fmt.Errorf("scan order item: %w", err)
		}
		byOrder[it.OrderID] = append(byOrder[it.OrderID], it)
	}

	for _, o := range orders {
		o.Items = byOrder[o.ID]
		if o.Items == nil {
			o.Items = []domain.OrderItem{}
		}
	}
	return nil
}
