-- Per-shop courier-API credentials. Steadfast (and other Bangladeshi couriers)
-- issue API keys per merchant account, so each shop stores its own. Secrets
-- are never returned to the browser — handlers expose only an "enabled" +
-- "configured" view.
CREATE TABLE shop_courier_settings (
    shop_id     uuid        PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    provider    text        NOT NULL DEFAULT 'steadfast' CHECK (provider IN ('steadfast')),
    api_key     text        NOT NULL DEFAULT '',
    secret_key  text        NOT NULL DEFAULT '',
    is_enabled  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_shop_courier_settings_updated_at
    BEFORE UPDATE ON shop_courier_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
