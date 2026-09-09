ALTER TABLE orders DROP COLUMN coupon_id, DROP COLUMN coupon_code, DROP COLUMN coupon_discount_bdt;
DROP TABLE coupons;
ALTER TABLE products DROP COLUMN advance_delivery_exempt;
