-- Add discount and per-product delivery charge fields.
ALTER TABLE products
    ADD COLUMN discount_type            text            CHECK (discount_type IN ('percentage', 'flat')),
    ADD COLUMN discount_value           numeric(10,2)   CHECK (discount_value >= 0),
    ADD COLUMN delivery_charge_dhaka    numeric(10,2)   CHECK (delivery_charge_dhaka >= 0),
    ADD COLUMN delivery_charge_outside  numeric(10,2)   CHECK (delivery_charge_outside >= 0);

-- Ensure discount_value is set when discount_type is set and vice-versa.
ALTER TABLE products
    ADD CONSTRAINT chk_discount_fields
    CHECK (
        (discount_type IS NULL AND discount_value IS NULL)
        OR (discount_type IS NOT NULL AND discount_value IS NOT NULL AND discount_value > 0)
    );
