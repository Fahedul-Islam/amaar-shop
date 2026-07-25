DROP TABLE IF EXISTS shop_ad_spend;

ALTER TABLE order_items DROP COLUMN IF EXISTS unit_cost_snapshot_bdt;
ALTER TABLE products    DROP COLUMN IF EXISTS cost_price_bdt;
