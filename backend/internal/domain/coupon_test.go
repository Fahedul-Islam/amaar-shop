package domain

import (
	"testing"
	"time"
)

func TestCouponDiscount(t *testing.T) {
	now := time.Now()
	base := Coupon{AmountBDT: "150.25", IsActive: true, ExpiresAt: now.Add(time.Hour), BuyerPhone: "01712345678"}
	for _, tc := range []struct {
		name     string
		subtotal float64
		phone    string
		edit     func(*Coupon)
		want     float64
		invalid  bool
	}{
		{"fixed", 200, "01712345678", nil, 150.25, false},
		{"cap", 100, "01712345678", nil, 100, false},
		{"wrong buyer", 200, "01812345678", nil, 0, true},
		{"expired", 200, "01712345678", func(c *Coupon) { c.ExpiresAt = now }, 0, true},
		{"disabled", 200, "01712345678", func(c *Coupon) { c.IsActive = false }, 0, true},
		{"used", 200, "01712345678", func(c *Coupon) { c.RedeemedAt = &now }, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := base
			if tc.edit != nil {
				tc.edit(&c)
			}
			got, err := c.Discount(tc.subtotal, tc.phone, now)
			if (err != nil) != tc.invalid || got != tc.want {
				t.Fatal(got, err)
			}
		})
	}
}
