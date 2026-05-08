package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type paymentMethodRepo struct {
	db *sql.DB
}

func NewPaymentMethodRepo(db *sql.DB) repository.PaymentMethodRepository {
	return &paymentMethodRepo{db: db}
}

const paymentMethodColumns = `id, shop_id, method_type, display_order, is_active,
	COALESCE(bank_name,''), COALESCE(account_number,''), COALESCE(account_name,''),
	COALESCE(branch,''), COALESCE(routing_number,''),
	COALESCE(mb_provider,''), COALESCE(mb_phone,''), COALESCE(mb_number_type,''),
	created_at, updated_at`

func scanPaymentMethod(scanner interface{ Scan(...any) error }) (*domain.ShopPaymentMethod, error) {
	m := &domain.ShopPaymentMethod{}
	err := scanner.Scan(
		&m.ID, &m.ShopID, &m.MethodType, &m.DisplayOrder, &m.IsActive,
		&m.BankName, &m.AccountNumber, &m.AccountName, &m.Branch, &m.RoutingNumber,
		&m.MBProvider, &m.MBPhone, &m.MBNumberType,
		&m.CreatedAt, &m.UpdatedAt,
	)
	return m, err
}

func (r *paymentMethodRepo) List(ctx context.Context, shopID string) ([]*domain.ShopPaymentMethod, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+paymentMethodColumns+`
		 FROM shop_payment_methods
		 WHERE shop_id = $1
		 ORDER BY display_order, created_at`,
		shopID,
	)
	if err != nil {
		return nil, fmt.Errorf("query payment methods: %w", err)
	}
	defer rows.Close()

	out := []*domain.ShopPaymentMethod{}
	for rows.Next() {
		m, err := scanPaymentMethod(rows)
		if err != nil {
			return nil, fmt.Errorf("scan payment method: %w", err)
		}
		out = append(out, m)
	}
	return out, nil
}

func (r *paymentMethodRepo) ListPublic(ctx context.Context, shopID string) ([]*domain.ShopPaymentMethod, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+paymentMethodColumns+`
		 FROM shop_payment_methods
		 WHERE shop_id = $1 AND is_active = true
		 ORDER BY display_order, created_at`,
		shopID,
	)
	if err != nil {
		return nil, fmt.Errorf("query public payment methods: %w", err)
	}
	defer rows.Close()

	out := []*domain.ShopPaymentMethod{}
	for rows.Next() {
		m, err := scanPaymentMethod(rows)
		if err != nil {
			return nil, fmt.Errorf("scan payment method: %w", err)
		}
		out = append(out, m)
	}
	return out, nil
}

func (r *paymentMethodRepo) Get(ctx context.Context, id string) (*domain.ShopPaymentMethod, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT `+paymentMethodColumns+` FROM shop_payment_methods WHERE id = $1`, id)
	m, err := scanPaymentMethod(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrPaymentMethodNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get payment method: %w", err)
	}
	return m, nil
}

func (r *paymentMethodRepo) Create(ctx context.Context, m *domain.ShopPaymentMethod) error {
	return r.db.QueryRowContext(ctx,
		`INSERT INTO shop_payment_methods
		   (shop_id, method_type, display_order, is_active,
		    bank_name, account_number, account_name, branch, routing_number,
		    mb_provider, mb_phone, mb_number_type)
		 VALUES ($1,$2,$3,$4,
		         NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''), NULLIF($9,''),
		         NULLIF($10,''), NULLIF($11,''), NULLIF($12,''))
		 RETURNING id, created_at, updated_at`,
		m.ShopID, m.MethodType, m.DisplayOrder, m.IsActive,
		m.BankName, m.AccountNumber, m.AccountName, m.Branch, m.RoutingNumber,
		m.MBProvider, m.MBPhone, m.MBNumberType,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
}

func (r *paymentMethodRepo) Update(ctx context.Context, m *domain.ShopPaymentMethod) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE shop_payment_methods SET
		   method_type = $1,
		   display_order = $2,
		   is_active = $3,
		   bank_name = NULLIF($4,''),
		   account_number = NULLIF($5,''),
		   account_name = NULLIF($6,''),
		   branch = NULLIF($7,''),
		   routing_number = NULLIF($8,''),
		   mb_provider = NULLIF($9,''),
		   mb_phone = NULLIF($10,''),
		   mb_number_type = NULLIF($11,'')
		 WHERE id = $12 AND shop_id = $13`,
		m.MethodType, m.DisplayOrder, m.IsActive,
		m.BankName, m.AccountNumber, m.AccountName, m.Branch, m.RoutingNumber,
		m.MBProvider, m.MBPhone, m.MBNumberType,
		m.ID, m.ShopID,
	)
	if err != nil {
		return fmt.Errorf("update payment method: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return domain.ErrPaymentMethodNotFound
	}
	return nil
}

func (r *paymentMethodRepo) Delete(ctx context.Context, shopID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM shop_payment_methods WHERE id = $1 AND shop_id = $2`, id, shopID)
	if err != nil {
		return fmt.Errorf("delete payment method: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return domain.ErrPaymentMethodNotFound
	}
	return nil
}
