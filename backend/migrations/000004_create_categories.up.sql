CREATE TABLE categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_categories_shop_name ON categories (shop_id, lower(name));
CREATE INDEX idx_categories_shop_id ON categories (shop_id);
