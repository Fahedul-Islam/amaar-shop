-- Shipment/courier record on orders. Manual entry in Phase 1; a courier-API
-- integration (Steadfast/Pathao) can later populate the same columns.
ALTER TABLE orders
    ADD COLUMN courier_name text,
    ADD COLUMN tracking_id  text;

-- The service layer's status transition map already allows shipped->returned
-- (a rejected cash-on-delivery parcel comes back as "returned"), but the
-- original CHECK constraint never permitted the value — so the UPDATE would
-- fail at the DB. Widen it to include 'returned'.
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending','confirmed','shipped','delivered','returned','cancelled'));
