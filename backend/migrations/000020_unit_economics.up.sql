-- Unit economics: what a product costs the seller, and what they spend on ads.
-- Together these turn "revenue" into "profit".

-- What the seller pays their supplier per unit. NULL = not entered yet, which
-- the profit report surfaces as "incomplete" rather than assuming zero cost.
ALTER TABLE products
    ADD COLUMN cost_price_bdt numeric(10,2) NULL CHECK (cost_price_bdt IS NULL OR cost_price_bdt >= 0);

-- Cost is snapshotted onto the line item like name/price already are, so that
-- editing a product's cost tomorrow never rewrites the profit of past orders.
ALTER TABLE order_items
    ADD COLUMN unit_cost_snapshot_bdt numeric(10,2) NULL;

-- Daily ad spend per platform. One row per (shop, date, platform) so re-entering
-- a day's spend corrects it instead of double-counting.
CREATE TABLE shop_ad_spend (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    spend_date  date          NOT NULL,
    platform    text          NOT NULL CHECK (platform IN ('facebook','tiktok','instagram','google','other')),
    amount_bdt  numeric(10,2) NOT NULL CHECK (amount_bdt >= 0),
    note        text,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT shop_ad_spend_unique_day_platform UNIQUE (shop_id, spend_date, platform)
);

CREATE INDEX idx_shop_ad_spend_shop_date ON shop_ad_spend (shop_id, spend_date DESC);

CREATE TRIGGER set_shop_ad_spend_updated_at
    BEFORE UPDATE ON shop_ad_spend
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
