ALTER TABLE products ADD COLUMN advance_delivery_exempt BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE coupons (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 amount_bdt NUMERIC(12,2) NOT NULL CHECK (amount_bdt > 0),
 buyer_phone TEXT NOT NULL DEFAULT '',
 expires_at TIMESTAMPTZ NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true,
 redeemed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(shop_id,code)
);
ALTER TABLE orders ADD COLUMN coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
 ADD COLUMN coupon_code TEXT NOT NULL DEFAULT '',
 ADD COLUMN coupon_discount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (coupon_discount_bdt >= 0);
