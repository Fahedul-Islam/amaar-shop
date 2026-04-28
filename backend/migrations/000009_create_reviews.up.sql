CREATE TABLE product_reviews (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id      uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id        uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id   uuid          NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
    customer_name   text          NOT NULL,
    customer_phone  text          NOT NULL,
    rating          smallint      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body            text          NOT NULL DEFAULT '',
    image_url       text,
    owner_reply     text,
    owner_replied_at timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_reviews_shop_created ON product_reviews (shop_id, created_at DESC);
CREATE INDEX idx_product_reviews_product_created ON product_reviews (product_id, created_at DESC);

CREATE TRIGGER set_product_reviews_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
