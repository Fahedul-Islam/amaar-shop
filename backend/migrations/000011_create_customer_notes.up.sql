-- normalize_phone strips non-digits and keeps only the trailing 11 chars,
-- so "01712345678", "+8801712345678", and "880 1712-345678" all collapse to
-- the same key. Bangladesh mobile numbers are 11 digits beginning with 01.
CREATE OR REPLACE FUNCTION normalize_phone(p text) RETURNS text AS $$
    SELECT right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 11)
$$ LANGUAGE SQL IMMUTABLE;

-- Functional index so customer aggregation by phone is cheap even when the
-- raw orders.customer_phone column has formatting noise.
CREATE INDEX idx_orders_norm_phone ON orders (shop_id, normalize_phone(customer_phone));

CREATE TABLE customer_notes (
    shop_id          uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_phone   text          NOT NULL,
    note             text          NOT NULL,
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    created_at       timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, customer_phone)
);

CREATE TRIGGER set_customer_notes_updated_at
    BEFORE UPDATE ON customer_notes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
