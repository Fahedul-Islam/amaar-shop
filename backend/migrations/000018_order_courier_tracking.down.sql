ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled'));

ALTER TABLE orders
    DROP COLUMN tracking_id,
    DROP COLUMN courier_name;
