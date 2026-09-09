package repository

import (
	"context"
	"github.com/fhedul/amaarshop/backend/internal/domain"
)

type CouponRepository interface {
	Create(context.Context, *domain.Coupon) error
	List(context.Context, string) ([]*domain.Coupon, error)
	Find(context.Context, string, string) (*domain.Coupon, error)
	Disable(context.Context, string, string) error
}
