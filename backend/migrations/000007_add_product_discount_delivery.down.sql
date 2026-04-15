ALTER TABLE products
    DROP CONSTRAINT IF EXISTS chk_discount_fields,
    DROP COLUMN IF EXISTS discount_type,
    DROP COLUMN IF EXISTS discount_value,
    DROP COLUMN IF EXISTS delivery_charge_dhaka,
    DROP COLUMN IF EXISTS delivery_charge_outside;
