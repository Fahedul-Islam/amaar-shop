CREATE TABLE orders (
    id                       uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id                  uuid            NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    customer_name            text            NOT NULL,
    customer_phone           text            NOT NULL,
    delivery_address         text            NOT NULL,
    delivery_area            text            NOT NULL,
    note                     text,
    subtotal_bdt             numeric(10,2)   NOT NULL,
    delivery_charge_bdt      numeric(10,2)   NOT NULL DEFAULT 0,
    total_bdt                numeric(10,2)   NOT NULL,
    status                   text            NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
    advance_payment_required boolean         NOT NULL DEFAULT false,
    advance_payment_received boolean         NOT NULL DEFAULT false,
    cancelled_reason         text,
    created_at               timestamptz     NOT NULL DEFAULT now(),
    updated_at               timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_shop_status_date ON orders (shop_id, status, created_at DESC);
CREATE INDEX idx_orders_shop_phone ON orders (shop_id, customer_phone);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
    id                      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                uuid            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id              uuid            NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot   text            NOT NULL,
    unit_price_snapshot_bdt numeric(10,2)   NOT NULL,
    quantity                integer         NOT NULL CHECK (quantity > 0),
    line_total_bdt          numeric(10,2)   NOT NULL,
    created_at              timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
