-- Seller-configured payment methods for advance delivery fee collection.
-- One row per bank or mobile-banking option a shop accepts.
CREATE TABLE shop_payment_methods (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid           NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    method_type     text           NOT NULL CHECK (method_type IN ('bank','mobile_banking')),
    display_order   integer        NOT NULL DEFAULT 0,
    is_active       boolean        NOT NULL DEFAULT true,

    -- Bank fields (NULL when method_type='mobile_banking')
    bank_name       text,
    account_number  text,
    account_name    text,
    branch          text,
    routing_number  text,

    -- Mobile-banking fields (NULL when method_type='bank')
    mb_provider     text,
    mb_phone        text,
    mb_number_type  text CHECK (mb_number_type IS NULL OR mb_number_type IN ('personal','agent','merchant')),

    created_at      timestamptz    NOT NULL DEFAULT now(),
    updated_at      timestamptz    NOT NULL DEFAULT now(),

    -- Field-set must match method_type.
    CONSTRAINT payment_method_fields_match_type CHECK (
        (method_type = 'bank' AND bank_name IS NOT NULL AND account_number IS NOT NULL AND account_name IS NOT NULL
         AND mb_provider IS NULL AND mb_phone IS NULL AND mb_number_type IS NULL)
        OR
        (method_type = 'mobile_banking' AND mb_provider IS NOT NULL AND mb_phone IS NOT NULL AND mb_number_type IS NOT NULL
         AND bank_name IS NULL AND account_number IS NULL AND account_name IS NULL AND branch IS NULL AND routing_number IS NULL)
    )
);

CREATE INDEX idx_shop_payment_methods_shop ON shop_payment_methods (shop_id, is_active, display_order);

CREATE TRIGGER set_shop_payment_methods_updated_at
    BEFORE UPDATE ON shop_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Per-order advance-payment proof submitted by the buyer.
ALTER TABLE orders
    ADD COLUMN advance_payment_method_id   uuid        NULL REFERENCES shop_payment_methods(id) ON DELETE SET NULL,
    ADD COLUMN advance_payment_txn_ref     text        NULL,
    ADD COLUMN advance_payment_receipt     text        NULL,
    ADD COLUMN advance_payment_submitted_at timestamptz NULL;

CREATE INDEX idx_orders_advance_payment_method ON orders (advance_payment_method_id);
