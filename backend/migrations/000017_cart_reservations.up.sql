-- Cart reservations hold stock for a buyer between entering the checkout
-- form and pressing "Place order". The hold is necessary because advance-
-- payment shops require the buyer to upload proof — a multi-minute step
-- during which other buyers could otherwise grab the last unit.
--
-- Stock semantics: when a reservation is CREATED, the reserved quantity
-- is decremented from products.stock atomically (so other buyers
-- immediately see fewer units available). On consume, the order is just
-- recorded — no stock change. On expire/cancel, the reserved quantity is
-- added back to products.stock.

CREATE TABLE cart_reservations (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid           NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    -- Filled in by the frontend once the buyer types their phone on the
    -- form, purely for admin visibility. Reservations are otherwise
    -- identified by their unguessable UUID.
    customer_phone  text           NULL,
    status          text           NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','consumed','expired','cancelled')),
    expires_at      timestamptz    NOT NULL,
    created_at      timestamptz    NOT NULL DEFAULT now(),
    updated_at      timestamptz    NOT NULL DEFAULT now()
);

-- Partial index on active rows only — that's what the sweeper scans, and
-- it stays tiny because consumed/expired/cancelled rows accumulate but
-- aren't part of the hot path.
CREATE INDEX idx_cart_reservations_active_expires
    ON cart_reservations (expires_at)
    WHERE status = 'active';

CREATE INDEX idx_cart_reservations_shop ON cart_reservations (shop_id);

CREATE TRIGGER set_cart_reservations_updated_at
    BEFORE UPDATE ON cart_reservations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_reservation_items (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  uuid           NOT NULL REFERENCES cart_reservations(id) ON DELETE CASCADE,
    product_id      uuid           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity        integer        NOT NULL CHECK (quantity > 0),
    created_at      timestamptz    NOT NULL DEFAULT now(),
    UNIQUE (reservation_id, product_id)
);

CREATE INDEX idx_cart_reservation_items_product ON cart_reservation_items (product_id);
