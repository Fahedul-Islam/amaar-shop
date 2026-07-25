-- Recurring daily ad budgets. Most sellers spend a steady amount per day, so
-- rather than typing it in every morning they declare it once and a background
-- job fills the daily rows for them. Works for every seller — including the
-- many who buy ads through an agency and could never connect an ad API.
CREATE TABLE shop_ad_budgets (
    shop_id          uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    platform         text          NOT NULL CHECK (platform IN ('facebook','tiktok','instagram','google','other')),
    daily_amount_bdt numeric(10,2) NOT NULL CHECK (daily_amount_bdt >= 0),
    is_active        boolean       NOT NULL DEFAULT true,
    -- Filling never runs earlier than this, so enabling a budget today does not
    -- invent spend for last month.
    starts_on        date          NOT NULL DEFAULT CURRENT_DATE,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, platform)
);

CREATE TRIGGER set_shop_ad_budgets_updated_at
    BEFORE UPDATE ON shop_ad_budgets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Marks a spend row as auto-filled from a budget rather than confirmed by the
-- seller, so the profit report can show how much of the figure is an estimate.
-- Any manual entry for the same day+platform overwrites the estimate and clears
-- this flag.
ALTER TABLE shop_ad_spend
    ADD COLUMN is_estimated boolean NOT NULL DEFAULT false;
