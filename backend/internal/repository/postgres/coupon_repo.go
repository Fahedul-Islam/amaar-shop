package postgres

import (
	"context"
	"database/sql"
	"errors"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type couponRepo struct{ db database.DBTX }

func NewCouponRepo(db database.DBTX) repository.CouponRepository { return &couponRepo{db} }

const couponColumns = `id,shop_id,code,amount_bdt::text,buyer_phone,expires_at,is_active,redeemed_at,created_at`

func scanCoupon(row interface{ Scan(...any) error }) (*domain.Coupon, error) {
	c := &domain.Coupon{}
	err := row.Scan(&c.ID, &c.ShopID, &c.Code, &c.AmountBDT, &c.BuyerPhone, &c.ExpiresAt, &c.IsActive, &c.RedeemedAt, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrCouponInvalid
	}
	return c, err
}
func (r *couponRepo) Create(ctx context.Context, c *domain.Coupon) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO coupons(shop_id,code,amount_bdt,buyer_phone,expires_at) VALUES($1,$2,$3::numeric,$4,$5) RETURNING id,created_at`, c.ShopID, c.Code, c.AmountBDT, c.BuyerPhone, c.ExpiresAt).Scan(&c.ID, &c.CreatedAt)
}
func (r *couponRepo) List(ctx context.Context, shop string) ([]*domain.Coupon, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+couponColumns+` FROM coupons WHERE shop_id=$1 ORDER BY created_at DESC LIMIT 200`, shop)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.Coupon{}
	for rows.Next() {
		c, err := scanCoupon(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (r *couponRepo) Find(ctx context.Context, shop, code string) (*domain.Coupon, error) {
	return scanCoupon(r.db.QueryRowContext(ctx, `SELECT `+couponColumns+` FROM coupons WHERE shop_id=$1 AND code=$2`, shop, code))
}
func (r *couponRepo) Disable(ctx context.Context, shop, id string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE coupons SET is_active=false WHERE shop_id=$1 AND id=$2`, shop, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrCouponInvalid
	}
	return err
}
