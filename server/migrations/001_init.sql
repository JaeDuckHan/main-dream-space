DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_type_enum') THEN
    CREATE TYPE action_type_enum AS ENUM ('external', 'internal', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'affiliate_partner_enum') THEN
    CREATE TYPE affiliate_partner_enum AS ENUM ('agoda', 'booking', 'tripcom', 'skyscanner', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accommodation_type_enum') THEN
    CREATE TYPE accommodation_type_enum AS ENUM ('hotel', 'resort', 'apartment', 'villa', 'guesthouse');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accommodation_source_enum') THEN
    CREATE TYPE accommodation_source_enum AS ENUM ('manual', 'real_estate', 'partner_api');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'click_partner_enum') THEN
    CREATE TYPE click_partner_enum AS ENUM ('agoda', 'booking', 'tripcom', 'skyscanner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'click_target_enum') THEN
    CREATE TYPE click_target_enum AS ENUM ('checklist_item', 'accommodation');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS checklist_templates (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  action_type action_type_enum NOT NULL DEFAULT 'none',
  action_url VARCHAR(1000),
  action_label VARCHAR(100),
  affiliate_partner affiliate_partner_enum NOT NULL DEFAULT 'none',
  affiliate_tag VARCHAR(200),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_template_sort ON checklist_items(template_id, sort_order);

CREATE TABLE IF NOT EXISTS checklist_progress (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  item_id INT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_session ON checklist_progress(session_id);
DROP TRIGGER IF EXISTS trg_progress_updated ON checklist_progress;
CREATE TRIGGER trg_progress_updated
  BEFORE UPDATE ON checklist_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS accommodations (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_ko VARCHAR(200),
  type accommodation_type_enum NOT NULL,
  district VARCHAR(100),
  address TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  price_min_usd INT NOT NULL,
  price_max_usd INT NOT NULL,
  price_monthly_usd INT,
  currency VARCHAR(3) DEFAULT 'USD',
  rating NUMERIC(2,1),
  review_count INT DEFAULT 0,
  bedrooms SMALLINT,
  max_guests SMALLINT,
  amenities JSONB,
  thumbnail_url VARCHAR(500),
  image_urls JSONB,
  agoda_url VARCHAR(1000),
  agoda_hotel_id VARCHAR(50),
  booking_url VARCHAR(1000),
  tripcom_url VARCHAR(1000),
  source accommodation_source_enum DEFAULT 'manual',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acc_price ON accommodations(price_min_usd);
CREATE INDEX IF NOT EXISTS idx_acc_district ON accommodations(district);
CREATE INDEX IF NOT EXISTS idx_acc_active ON accommodations(is_active);
CREATE INDEX IF NOT EXISTS idx_acc_amenities ON accommodations USING GIN (amenities);
DROP TRIGGER IF EXISTS trg_acc_updated ON accommodations;
CREATE TRIGGER trg_acc_updated
  BEFORE UPDATE ON accommodations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(64),
  partner click_partner_enum NOT NULL,
  target_type click_target_enum NOT NULL,
  target_id INT NOT NULL,
  referrer VARCHAR(500),
  user_agent VARCHAR(500),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clicks_partner_time ON affiliate_clicks(partner, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_target ON affiliate_clicks(target_type, target_id);
