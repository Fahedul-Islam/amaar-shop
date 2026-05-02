-- Platform-wide fee rule. There's exactly one row (id=1) — admins update
-- it instead of inserting new rows so the "current rule" is always trivial
-- to look up. Past payments stay correct because the amount is recorded
-- on the payment row at the time of approval — we don't recompute history.
CREATE TABLE fee_rule (
    id          int           PRIMARY KEY DEFAULT 1,
    rule_type   text          NOT NULL CHECK (rule_type IN ('percentage', 'fixed_per_order')),
    -- For 'percentage': value is the percent (e.g. 5.00 = 5%).
    -- For 'fixed_per_order': value is BDT charged per non-cancelled order.
    value       numeric(12,4) NOT NULL CHECK (value >= 0),
    description text,
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    updated_by  uuid          REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fee_rule_singleton CHECK (id = 1)
);

-- Seed the default rule that matches the previous hard-coded 5% behavior,
-- so existing reports keep showing the same numbers right after migration.
INSERT INTO fee_rule (id, rule_type, value, description)
VALUES (1, 'percentage', 5.0, 'AmaarShop platform fee')
ON CONFLICT DO NOTHING;

-- Shop owners submit a payment claim ("I sent ৳X via bKash, txn id Y").
-- Admin reviews and either approves (creating a row in shop_fee_payments)
-- or rejects with feedback. While pending, the shop sees "under review".
CREATE TABLE shop_fee_submissions (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    -- What the seller claims to have sent.
    amount_bdt      numeric(12,2) NOT NULL CHECK (amount_bdt > 0),
    payment_method  text          NOT NULL CHECK (payment_method IN (
                        'bkash', 'nagad', 'rocket', 'bank_transfer', 'cash', 'other'
                    )),
    transaction_id  text          NOT NULL,
    sender_account  text,                       -- e.g. seller's bKash number
    note            text,                       -- seller's optional note
    status          text          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_feedback  text,                       -- admin's note on review (esp. rejections)
    reviewed_by     uuid          REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     timestamptz,
    -- When approved, links to the shop_fee_payments row that was created.
    -- This lets the seller see "your payment was confirmed → settled".
    fee_payment_id  uuid          REFERENCES shop_fee_payments(id) ON DELETE SET NULL,
    submitted_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_fee_submissions_shop_id ON shop_fee_submissions (shop_id, submitted_at DESC);
CREATE INDEX idx_shop_fee_submissions_status ON shop_fee_submissions (status, submitted_at DESC);
