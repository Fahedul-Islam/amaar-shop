package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type CouponService struct {
	shops   repository.ShopRepository
	coupons repository.CouponRepository
}

func NewCouponService(shops repository.ShopRepository, coupons repository.CouponRepository) *CouponService {
	return &CouponService{shops, coupons}
}
func (s *CouponService) Create(ctx context.Context, owner, amount, phone string, expires time.Time) (*domain.Coupon, error) {
	if !regexp.MustCompile(`^\d{1,7}(\.\d{1,2})?$`).MatchString(amount) {
		return nil, domain.ErrCouponInput
	}
	value, _ := strconv.ParseFloat(amount, 64)
	phone = normalizePhone(strings.TrimSpace(phone))
	if value <= 0 || value > 9999999 || !expires.After(time.Now()) || expires.After(time.Now().AddDate(1, 0, 0)) || (phone != "" && !regexp.MustCompile(`^01[3-9]\d{8}$`).MatchString(phone)) {
		return nil, domain.ErrCouponInput
	}
	shop, err := s.shops.FindByOwnerID(ctx, owner)
	if err != nil {
		return nil, err
	}
	b := make([]byte, 8)
	if _, err = rand.Read(b); err != nil {
		return nil, err
	}
	c := &domain.Coupon{ShopID: shop.ID, Code: strings.ToUpper(hex.EncodeToString(b)), AmountBDT: fmt.Sprintf("%.2f", value), BuyerPhone: phone, ExpiresAt: expires, IsActive: true}
	if err = s.coupons.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}
func (s *CouponService) List(ctx context.Context, owner string) ([]*domain.Coupon, error) {
	shop, err := s.shops.FindByOwnerID(ctx, owner)
	if err != nil {
		return nil, err
	}
	return s.coupons.List(ctx, shop.ID)
}
func (s *CouponService) Disable(ctx context.Context, owner, id string) error {
	shop, err := s.shops.FindByOwnerID(ctx, owner)
	if err != nil {
		return err
	}
	return s.coupons.Disable(ctx, shop.ID, id)
}
