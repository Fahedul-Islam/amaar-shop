package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

type cartReservationRepo struct {
	db *sql.DB
}

func NewCartReservationRepo(db *sql.DB) repository.CartReservationRepository {
	return &cartReservationRepo{db: db}
}

func (r *cartReservationRepo) Create(
	ctx context.Context,
	shopID string,
	expiresAt time.Time,
	items []repository.ReserveItemInput,
) (*domain.CartReservation, error) {
	if len(items) == 0 {
		return nil, domain.ErrEmptyReservation
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	res := &domain.CartReservation{
		ShopID:    shopID,
		Status:    domain.ReservationStatusActive,
		ExpiresAt: expiresAt,
	}
	err = tx.QueryRowContext(ctx,
		`INSERT INTO cart_reservations (shop_id, expires_at)
		 VALUES ($1, $2)
		 RETURNING id, status, created_at, updated_at`,
		shopID, expiresAt,
	).Scan(&res.ID, &res.Status, &res.CreatedAt, &res.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert reservation: %w", err)
	}

	res.Items = make([]domain.CartReservationItem, 0, len(items))
	for _, in := range items {
		// Decrement stock first — the CHECK (stock >= 0) constraint on
		// products surfaces an over-allocation as a check_violation,
		// which we map to ErrInsufficientStock. is_active/is_archived
		// gating mirrors what the regular order placement path does so
		// nobody can hold inventory on a hidden product.
		row, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = stock - $1
			 WHERE id = $2 AND shop_id = $3 AND is_active = true AND is_archived = false`,
			in.Quantity, in.ProductID, shopID,
		)
		if err != nil {
			var pqErr *pq.Error
			if errors.As(err, &pqErr) && pqErr.Code == "23514" {
				return nil, domain.ErrInsufficientStock
			}
			return nil, fmt.Errorf("decrement stock: %w", err)
		}
		affected, _ := row.RowsAffected()
		if affected == 0 {
			return nil, domain.ErrProductNotFound
		}

		var item domain.CartReservationItem
		err = tx.QueryRowContext(ctx,
			`INSERT INTO cart_reservation_items (reservation_id, product_id, quantity)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			res.ID, in.ProductID, in.Quantity,
		).Scan(&item.ID)
		if err != nil {
			return nil, fmt.Errorf("insert reservation item: %w", err)
		}
		item.ReservationID = res.ID
		item.ProductID = in.ProductID
		item.Quantity = in.Quantity
		res.Items = append(res.Items, item)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit reservation: %w", err)
	}
	return res, nil
}

func (r *cartReservationRepo) Get(ctx context.Context, shopID, id string) (*domain.CartReservation, error) {
	res := &domain.CartReservation{}
	var phone sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, shop_id, customer_phone, status, expires_at, created_at, updated_at
		 FROM cart_reservations WHERE id = $1 AND shop_id = $2`,
		id, shopID,
	).Scan(&res.ID, &res.ShopID, &phone, &res.Status, &res.ExpiresAt, &res.CreatedAt, &res.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrReservationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get reservation: %w", err)
	}
	if phone.Valid {
		res.CustomerPhone = phone.String
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, reservation_id, product_id, quantity
		 FROM cart_reservation_items WHERE reservation_id = $1`,
		res.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("query reservation items: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var it domain.CartReservationItem
		if err := rows.Scan(&it.ID, &it.ReservationID, &it.ProductID, &it.Quantity); err != nil {
			return nil, fmt.Errorf("scan reservation item: %w", err)
		}
		res.Items = append(res.Items, it)
	}
	if res.Items == nil {
		res.Items = []domain.CartReservationItem{}
	}
	return res, nil
}

func (r *cartReservationRepo) Cancel(ctx context.Context, shopID, id string) (*domain.CartReservation, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Lock the row so a parallel sweep or consume can't change status
	// out from under us.
	var status string
	err = tx.QueryRowContext(ctx,
		`SELECT status FROM cart_reservations
		 WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
		id, shopID,
	).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrReservationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock reservation: %w", err)
	}

	// If it's already non-active there's nothing to do — return the
	// current row unchanged so the caller's UI stays consistent.
	if status != domain.ReservationStatusActive {
		_ = tx.Commit()
		return r.Get(ctx, shopID, id)
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE cart_reservations
		 SET status = 'cancelled', updated_at = now()
		 WHERE id = $1`, id,
	); err != nil {
		return nil, fmt.Errorf("mark cancelled: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE products
		 SET stock = products.stock + i.quantity
		 FROM cart_reservation_items i
		 WHERE i.reservation_id = $1 AND products.id = i.product_id`,
		id,
	); err != nil {
		return nil, fmt.Errorf("restore stock on cancel: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit cancel: %w", err)
	}
	return r.Get(ctx, shopID, id)
}

func (r *cartReservationRepo) AttachPhone(ctx context.Context, id, phone string) error {
	if phone == "" {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE cart_reservations SET customer_phone = $1
		 WHERE id = $2 AND status = 'active'`, phone, id,
	)
	return err
}

func (r *cartReservationRepo) SweepExpired(ctx context.Context) (int, error) {
	// We can't fold the restore into a single UPDATE…FROM that joins
	// items to products: when several expired reservations share the
	// same product, the join produces multiple rows for one target and
	// Postgres only applies one of them ("a target row shouldn't join
	// to more than one row from the other tables"). That silently
	// dropped restores, leaking stock.
	//
	// Instead: expire the rows in step 1, then in step 2 SUM the held
	// quantities per product and apply one row per product. Both
	// steps live in the same transaction so a crash mid-sweep never
	// strands stock.
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin sweep tx: %w", err)
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx,
		`UPDATE cart_reservations
		    SET status = 'expired', updated_at = now()
		  WHERE status = 'active' AND expires_at < now()
		  RETURNING id`,
	)
	if err != nil {
		return 0, fmt.Errorf("mark expired: %w", err)
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scan expired id: %w", err)
		}
		ids = append(ids, id)
	}
	rows.Close()

	if len(ids) == 0 {
		return 0, tx.Commit()
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE products
		    SET stock = products.stock + agg.qty
		   FROM (
		       SELECT i.product_id, SUM(i.quantity)::int AS qty
		         FROM cart_reservation_items i
		        WHERE i.reservation_id = ANY($1::uuid[])
		        GROUP BY i.product_id
		   ) agg
		  WHERE products.id = agg.product_id`,
		pq.Array(ids),
	); err != nil {
		return 0, fmt.Errorf("restore stock on sweep: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit sweep: %w", err)
	}
	return len(ids), nil
}
