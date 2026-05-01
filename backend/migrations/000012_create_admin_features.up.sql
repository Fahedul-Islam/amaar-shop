-- Customer-submitted reports about a shop. Open reports surface in the
-- admin dashboard for review; admins resolve or dismiss with a note.
CREATE TABLE shop_reports (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    reason          text          NOT NULL CHECK (reason IN (
                        'counterfeit', 'scam', 'inappropriate',
                        'poor_quality', 'harassment', 'other'
                    )),
    description     text          NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
    -- Reporter identity is optional — buyers can report anonymously, but
    -- contact details help admins follow up.
    reporter_name   text,
    reporter_phone  text,
    status          text          NOT NULL DEFAULT 'open' CHECK (status IN (
                        'open', 'reviewing', 'resolved', 'dismissed'
                    )),
    admin_note      text,
    resolved_by     uuid          REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_shop_reports_shop_id ON shop_reports (shop_id);
CREATE INDEX idx_shop_reports_status_created ON shop_reports (status, created_at DESC);

-- Records of platform-fee payments made by shop owners.
-- AmaarShop is COD-first: money flows direct from buyer to shop in cash.
-- The shop owner then owes AmaarShop a 5% fee, billed in 14-day cycles.
-- A row here means "shop X paid Y BDT to the platform, settling fees on
-- all non-cancelled orders up to covers_until". The current outstanding
-- amount for a shop is computed as:
--   5% × (sum of total_bdt for non-cancelled orders since the last covers_until)
CREATE TABLE shop_fee_payments (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    amount_bdt    numeric(12,2) NOT NULL CHECK (amount_bdt > 0),
    -- This payment settles fees on orders created strictly before this timestamp.
    covers_until  timestamptz   NOT NULL,
    recorded_by   uuid          REFERENCES users(id) ON DELETE SET NULL,
    note          text,
    created_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_shop_fee_payments_shop_covers ON shop_fee_payments (shop_id, covers_until DESC);
