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
