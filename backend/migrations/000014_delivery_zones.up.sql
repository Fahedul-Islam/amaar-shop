-- Per-division delivery zones (replaces text[] delivery_areas)
CREATE TABLE shop_delivery_zones (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    division        text NOT NULL,
    delivery_charge numeric(10,2) NOT NULL CHECK (delivery_charge >= 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (shop_id, division)
);
CREATE INDEX idx_shop_delivery_zones_shop ON shop_delivery_zones(shop_id);

-- Drop the legacy free-text array
ALTER TABLE shop_delivery_settings DROP COLUMN delivery_areas;

-- Split delivery_area in orders into structured fields
ALTER TABLE orders
    ADD COLUMN delivery_division text NOT NULL DEFAULT '',
    ADD COLUMN delivery_district text NOT NULL DEFAULT '';

-- delivery_area becomes optional/derived (kept for backward compat)
ALTER TABLE orders ALTER COLUMN delivery_area DROP NOT NULL;
