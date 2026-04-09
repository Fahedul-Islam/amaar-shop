CREATE TABLE shops (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   uuid        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug            citext      UNIQUE NOT NULL,
    name            text        NOT NULL,
    description     text,
    logo_url        text,
    banner_url      text,
    contact_phone   text,
    is_suspended    boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shops_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);

CREATE TRIGGER set_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE shop_delivery_settings (
    shop_id                     uuid        PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    cod_enabled                 boolean     NOT NULL DEFAULT true,
    delivery_charge             numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
    free_delivery_threshold     numeric(10,2) CHECK (free_delivery_threshold > delivery_charge),
    advance_payment_required    boolean     NOT NULL DEFAULT false,
    advance_payment_instructions text,
    delivery_areas              text[]      NOT NULL DEFAULT '{}',
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_shop_delivery_settings_updated_at
    BEFORE UPDATE ON shop_delivery_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
