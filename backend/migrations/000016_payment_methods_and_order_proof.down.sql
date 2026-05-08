ALTER TABLE orders
    DROP COLUMN IF EXISTS advance_payment_submitted_at,
    DROP COLUMN IF EXISTS advance_payment_receipt,
    DROP COLUMN IF EXISTS advance_payment_txn_ref,
    DROP COLUMN IF EXISTS advance_payment_method_id;

DROP INDEX IF EXISTS idx_orders_advance_payment_method;

DROP TABLE IF EXISTS shop_payment_methods;
