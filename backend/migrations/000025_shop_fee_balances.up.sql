-- Preserve legacy settlements: their cutoff semantics cannot reconstruct historical
-- rate changes. Existing uncovered orders become the opening charge balance.
ALTER TABLE fee_rule DROP CONSTRAINT fee_rule_rule_type_check;
ALTER TABLE fee_rule ADD CHECK (rule_type IN ('percentage','fixed_per_order','fixed_per_item'));
CREATE TABLE shop_fee_rules (
 shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 rule_type text NOT NULL CHECK (rule_type IN ('percentage','fixed_per_order','fixed_per_item')),
 value numeric(12,4) NOT NULL CHECK (value >= 0 AND (rule_type <> 'percentage' OR value <= 100)),
 description text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE orders ADD COLUMN platform_fee_type text, ADD COLUMN platform_fee_value numeric(12,4);
UPDATE orders o SET platform_fee_type = f.rule_type, platform_fee_value = f.value
FROM fee_rule f WHERE f.id=1 AND NOT EXISTS (
 SELECT 1 FROM shop_fee_payments p WHERE p.shop_id=o.shop_id AND o.created_at < p.covers_until
);
ALTER TABLE shop_fee_payments ADD COLUMN balance_applicable boolean NOT NULL DEFAULT false;
ALTER TABLE shop_fee_payments ALTER COLUMN balance_applicable SET DEFAULT true;
CREATE FUNCTION snapshot_order_platform_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT rule_type,value INTO NEW.platform_fee_type,NEW.platform_fee_value FROM shop_fee_rules WHERE shop_id=NEW.shop_id;
 IF NOT FOUND THEN
  SELECT rule_type,value INTO NEW.platform_fee_type,NEW.platform_fee_value FROM fee_rule WHERE id=1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_platform_fee BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION snapshot_order_platform_fee();
CREATE VIEW order_platform_fees AS
 SELECT o.id, o.shop_id, o.created_at, o.total_bdt, COALESCE(i.units,0) AS units,
 ROUND(CASE o.platform_fee_type
 WHEN 'percentage' THEN o.total_bdt * o.platform_fee_value / 100
 WHEN 'fixed_per_order' THEN o.platform_fee_value
 WHEN 'fixed_per_item' THEN COALESCE(i.units,0) * o.platform_fee_value
 ELSE 0 END,2) AS fee_bdt
 FROM orders o LEFT JOIN LATERAL (SELECT SUM(quantity) AS units FROM order_items WHERE order_id=o.id) i ON true
 WHERE o.status <> 'cancelled' AND o.platform_fee_type IS NOT NULL;
CREATE VIEW shop_fee_balances AS
 SELECT s.id AS shop_id, COALESCE(c.orders,0) AS orders, COALESCE(c.units,0) AS units,
 COALESCE(c.gmv,0) AS gmv, COALESCE(c.charged,0) AS charged,
 COALESCE(p.paid,0) AS paid,
 GREATEST(COALESCE(c.charged,0)-COALESCE(p.paid,0),0) AS due,
 GREATEST(COALESCE(p.paid,0)-COALESCE(c.charged,0),0) AS credit
 FROM shops s
 LEFT JOIN (SELECT shop_id,COUNT(*) AS orders,SUM(units) AS units,SUM(total_bdt) AS gmv,SUM(fee_bdt) AS charged FROM order_platform_fees GROUP BY shop_id) c ON c.shop_id=s.id
 LEFT JOIN (SELECT shop_id,SUM(amount_bdt) AS paid FROM shop_fee_payments WHERE balance_applicable GROUP BY shop_id) p ON p.shop_id=s.id;
