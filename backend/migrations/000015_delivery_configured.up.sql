ALTER TABLE shop_delivery_settings
    ADD COLUMN is_configured boolean NOT NULL DEFAULT false;

-- Backfill: only treat a row as configured when the seller has actually picked
-- a meaningful setup (positive charge, zones, threshold, or advance payment).
-- A bare default row (charge 0 or 60, no zones, no threshold, no advance) is
-- still considered un-configured so the product gate kicks in.
UPDATE shop_delivery_settings
   SET is_configured = true
 WHERE shop_id IN (SELECT shop_id FROM shop_delivery_zones)
    OR delivery_charge > 0
    OR free_delivery_threshold IS NOT NULL
    OR advance_payment_required = true;
