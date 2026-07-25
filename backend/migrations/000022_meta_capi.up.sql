-- Meta Conversions API: server-side conversion tracking.
--
-- Sends purchase/delivery events straight from our server to Meta, so the
-- seller's ad targeting learns from real outcomes instead of browser pixels
-- that iOS, ad blockers and cookie limits routinely drop.

-- Per-shop Meta credentials. Like courier settings, the seller pastes these
-- from Events Manager; secrets are never returned to the browser.
CREATE TABLE shop_meta_settings (
    shop_id         uuid        PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    pixel_id        text        NOT NULL DEFAULT '',
    access_token    text        NOT NULL DEFAULT '',
    is_enabled      boolean     NOT NULL DEFAULT false,
    -- When true, a second conversion fires once the parcel is actually
    -- delivered. For cash-on-delivery this is the event worth optimising for:
    -- it teaches Meta to find buyers who accept the parcel, not just people
    -- who place orders and then refuse them.
    track_delivered boolean     NOT NULL DEFAULT true,
    -- Optional Events Manager "test event code" for verifying the integration
    -- without polluting live data.
    test_event_code text        NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Outbox of conversion events. Rows are written in the request path (cheap,
-- never blocks the buyer) and delivered by a background dispatcher, so a Meta
-- outage or slow response can never fail an order. The table doubles as the
-- event log the seller's tracking-health stats are computed from.
CREATE TABLE meta_events (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       uuid          NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id      uuid          NULL REFERENCES orders(id) ON DELETE SET NULL,
    event_name    text          NOT NULL,
    -- Deduplication key shared with the browser pixel, so the same conversion
    -- reported by both channels is only counted once by Meta.
    event_id      text          NOT NULL,
    status        text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','sent','failed')),
    attempts      integer       NOT NULL DEFAULT 0,
    last_error    text          NULL,
    value_bdt     numeric(10,2) NOT NULL DEFAULT 0,
    -- How many identity fields (phone, name, city, ...) were attached. Meta
    -- matches events to people using these, so a higher count means better
    -- attribution — this is what the "match quality" stat is derived from.
    match_fields  integer       NOT NULL DEFAULT 0,
    event_time    timestamptz   NOT NULL DEFAULT now(),
    sent_at       timestamptz   NULL,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    -- One event of a given kind per order; makes enqueueing idempotent.
    CONSTRAINT meta_events_unique_event UNIQUE (shop_id, event_id)
);

-- Dispatcher looks up pending work oldest-first.
CREATE INDEX idx_meta_events_pending ON meta_events (status, created_at)
    WHERE status = 'pending';
CREATE INDEX idx_meta_events_shop_time ON meta_events (shop_id, created_at DESC);
