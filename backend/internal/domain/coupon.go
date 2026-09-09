package domain

import (
	"errors"
	"math"
	"strconv"
	"time"
)

var ErrCouponInvalid = errors.New("coupon is invalid, expired, already used, or unavailable for this phone number")
var ErrCouponInput = errors.New("enter a discount between 0.01 and 9999999 taka, a valid expiry, and an optional Bangladeshi phone number")

type Coupon struct {
	ID         string     `json:"id"`
	ShopID     string     `json:"shop_id"`
	Code       string     `json:"code"`
	AmountBDT  string     `json:"amount_bdt"`
	BuyerPhone string     `json:"buyer_phone"`
	ExpiresAt  time.Time  `json:"expires_at"`
	IsActive   bool       `json:"is_active"`
	RedeemedAt *time.Time `json:"redeemed_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

// Discount caps a fixed coupon at the merchandise subtotal; delivery is unchanged.
func (c Coupon) Discount(subtotal float64, phone string, now time.Time) (float64, error) {
	if !c.IsActive || c.RedeemedAt != nil || !c.ExpiresAt.After(now) || (c.BuyerPhone != "" && c.BuyerPhone != phone) {
		return 0, ErrCouponInvalid
	}
	amount, err := strconv.ParseFloat(c.AmountBDT, 64)
	if err != nil || math.IsNaN(amount) || math.IsInf(amount, 0) || amount <= 0 || subtotal < 0 || math.IsNaN(subtotal) || math.IsInf(subtotal, 0) {
		return 0, ErrCouponInvalid
	}
	return math.Min(math.Round(amount*100), math.Round(subtotal*100)) / 100, nil
}
