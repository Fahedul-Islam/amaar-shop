ALTER TABLE orders DROP COLUMN delivery_division, DROP COLUMN delivery_district;
ALTER TABLE orders ALTER COLUMN delivery_area SET NOT NULL;
ALTER TABLE shop_delivery_settings ADD COLUMN delivery_areas text[] NOT NULL DEFAULT '{}';
DROP TABLE shop_delivery_zones;
