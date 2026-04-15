-- server/migrations/010_orders.sql
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  product_id INT NOT NULL REFERENCES products(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'payment_checking', 'confirmed', 'cancelled')),
  total_price INT NOT NULL,
  orderer_name VARCHAR(100) NOT NULL,
  orderer_phone VARCHAR(30) NOT NULL,
  orderer_email VARCHAR(200) NOT NULL,
  booking_data JSONB NOT NULL DEFAULT '{}',
  memo TEXT,
  admin_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS order_options (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  option_id INT REFERENCES product_options(id) ON DELETE SET NULL,
  label VARCHAR(100) NOT NULL,
  price_delta INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_options_order ON order_options(order_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_site_settings_updated ON site_settings;
CREATE TRIGGER trg_site_settings_updated
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO site_settings (key, value) VALUES
  ('bank_name', ''),
  ('bank_account', ''),
  ('bank_holder', ''),
  ('bank_notice', '주문 후 24시간 내 입금해주세요'),
  ('company_name', ''),
  ('company_ceo', ''),
  ('company_biz_no', ''),
  ('company_email', ''),
  ('company_address', '')
ON CONFLICT (key) DO NOTHING;
