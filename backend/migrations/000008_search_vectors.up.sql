-- Generated tsvector columns let PostgreSQL maintain the index automatically.
-- 'simple' dictionary: lowercases and removes stop words without English stemming,
-- which is correct for BD product names that mix Bengali and English.
-- Weight A = name (more relevant), Weight B = description (less relevant).

ALTER TABLE products
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED;

CREATE INDEX idx_products_search_vector ON products USING GIN (search_vector);

ALTER TABLE shops
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED;

CREATE INDEX idx_shops_search_vector ON shops USING GIN (search_vector);
