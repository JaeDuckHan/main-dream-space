CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('package', 'pickup')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  base_price INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, sort_order);

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS product_options (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id, sort_order);
