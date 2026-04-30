-- Raw per-request product visit log. Rows are inserted asynchronously by the
-- visit worker (one row per non-bot product page hit). The table grows fast,
-- so we keep it append-only and roll it up nightly into product_visit_summary.
CREATE TABLE product_visits (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id      uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id   uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- visitor_id is sha256(ip + user-agent + daily-salt), letting us count
    -- unique visitors without storing raw IPs.
    visitor_id   text        NOT NULL,
    referrer     text,
    user_agent   text,
    visited_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_visits_shop_visited_at    ON product_visits (shop_id, visited_at DESC);
CREATE INDEX idx_product_visits_product_visited_at ON product_visits (product_id, visited_at DESC);
CREATE INDEX idx_product_visits_visitor            ON product_visits (visitor_id, product_id, visited_at);

-- Pre-aggregated daily metrics per shop/product. The cron job upserts into this
-- table once a day; dashboards read here so they don't scan the raw log.
CREATE TABLE product_visit_summary (
    shop_id       uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id    uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    visit_date    date        NOT NULL,
    total_visits  integer     NOT NULL DEFAULT 0,
    unique_visits integer     NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, product_id, visit_date)
);

CREATE INDEX idx_visit_summary_shop_date    ON product_visit_summary (shop_id, visit_date DESC);
CREATE INDEX idx_visit_summary_product_date ON product_visit_summary (product_id, visit_date DESC);
