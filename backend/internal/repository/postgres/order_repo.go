package postgres

import (
	"context"
	"database/sql"
	"fmt"

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
	o.delivery_area, o.note, o.subtotal_bdt, o.delivery_charge_bdt,
	o.total_bdt, o.status, o.advance_payment_required,
	o.advance_payment_received, o.cancelled_reason, o.created_at, o.updated_at`

// scanOrder scans a row into a domain.Order matching orderColumns.
func scanOrder(scanner interface{ Scan(...any) error }) (*domain.Order, error) {
	o := &domain.Order{}
	err := scanner.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone, &o.DeliveryAddress,
		&o.DeliveryArea, &o.Note, &o.SubtotalBDT, &o.DeliveryChargeBDT,
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
		    delivery_area, note, subtotal_bdt, delivery_charge_bdt, total_bdt,
		    advance_payment_required)
		 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7::numeric, $8::numeric, $9::numeric, $10)
		 RETURNING id, status, advance_payment_received, created_at, updated_at`,
		order.ShopID, order.CustomerName, order.CustomerPhone, order.DeliveryAddress,
		order.DeliveryArea, order.Note, order.SubtotalBDT, order.DeliveryChargeBDT,
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

func (r *orderRepo) OrderListByShopOwner(ctx context.Context, ownerUserID string, limit, offset int) ([]*domain.Order, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+orderColumns+`
		 FROM orders o
		 JOIN shops s ON s.id = o.shop_id
		 WHERE s.owner_user_id = $1
		 ORDER BY o.created_at DESC
		 LIMIT $2 OFFSET $3`,
		ownerUserID, limit, offset,
	)
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

func (r *orderRepo) UpdateOrderStatusForShopOwner(ctx context.Context, ownerUserID, orderID, status string, cancelledReason *string) (*domain.Order, error) {
	row := r.db.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = $1, cancelled_reason = $2
		 FROM shops
		 WHERE shops.id = orders.shop_id
		   AND shops.owner_user_id = $3
		   AND orders.id = $4
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, orders.delivery_area, orders.note,
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		status, cancelledReason, ownerUserID, orderID,
	)

	o := &domain.Order{}
	err := row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryArea, &o.Note,
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

func (r *orderRepo) CancelOrderByBuyer(ctx context.Context, shopID, orderID, customerPhone, cancelledReason string) (*domain.Order, error) {
	row := r.db.QueryRowContext(ctx,
		`UPDATE orders
		 SET status = 'cancelled', cancelled_reason = $1
		 WHERE shop_id = $2
		   AND id = $3
		   AND customer_phone = $4
		   AND status = 'pending'
		 RETURNING orders.id, orders.shop_id, orders.customer_name, orders.customer_phone,
		   orders.delivery_address, orders.delivery_area, orders.note,
		   orders.subtotal_bdt, orders.delivery_charge_bdt, orders.total_bdt,
		   orders.status, orders.advance_payment_required, orders.advance_payment_received,
		   orders.cancelled_reason, orders.created_at, orders.updated_at`,
		cancelledReason, shopID, orderID, customerPhone,
	)

	o := &domain.Order{}
	err := row.Scan(
		&o.ID, &o.ShopID, &o.CustomerName, &o.CustomerPhone,
		&o.DeliveryAddress, &o.DeliveryArea, &o.Note,
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
	return o, nil
}
