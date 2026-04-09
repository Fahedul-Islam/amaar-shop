CREATE TABLE products (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid            NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id uuid            REFERENCES categories(id) ON DELETE SET NULL,
    name        text            NOT NULL,
    description text,
    price_bdt   numeric(10,2)   NOT NULL CHECK (price_bdt > 0),
    stock       integer         NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active   boolean         NOT NULL DEFAULT true,
    is_archived boolean         NOT NULL DEFAULT false,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    updated_at  timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_shop_active ON products (shop_id, is_active, is_archived);
CREATE INDEX idx_products_shop_category ON products (shop_id, category_id);
CREATE INDEX idx_products_shop_not_archived ON products (shop_id) WHERE is_archived = false;
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_images (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url         text        NOT NULL,
    sort_order  integer     NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product_sort ON product_images (product_id, sort_order);

CREATE TABLE product_variants (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      uuid            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            text            NOT NULL,
    sku             text,
    price_override  numeric(10,2)   CHECK (price_override >= 0),
    stock           integer         NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at      timestamptz     NOT NULL DEFAULT now()
);
