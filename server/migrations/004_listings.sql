DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_category_enum') THEN
    CREATE TYPE listing_category_enum AS ENUM (
      'accommodation', 'restaurant', 'massage', 'real_estate', 'tour'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status_enum') THEN
    CREATE TYPE listing_status_enum AS ENUM (
      'draft', 'pending', 'approved', 'rejected', 'archived'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_source_enum') THEN
    CREATE TYPE photo_source_enum AS ENUM (
      'official', 'google_maps', 'agoda', 'owner_provided', 'self_taken'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  category listing_category_enum NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_ko VARCHAR(200),
  name_en VARCHAR(200),
  district VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  google_maps_url VARCHAR(1000) NOT NULL,
  google_maps_place_id VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  contact_email VARCHAR(255),
  website VARCHAR(500),
  kakao_channel VARCHAR(255),
  thumbnail_url VARCHAR(1000),
  image_urls JSONB,
  rating NUMERIC(2,1),
  review_count INT DEFAULT 0,
  description TEXT,
  description_ko TEXT,
  korean_friendly BOOLEAN DEFAULT FALSE,
  korean_speaking_staff BOOLEAN DEFAULT FALSE,
  korean_menu_signage BOOLEAN DEFAULT FALSE,
  category_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  agoda_url VARCHAR(1000),
  agoda_hotel_id VARCHAR(50),
  booking_url VARCHAR(1000),
  tripcom_url VARCHAR(1000),
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  status listing_status_enum NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by INT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_url VARCHAR(1000),
  collected_by VARCHAR(50),
  collected_at TIMESTAMPTZ,
  place_id_verified BOOLEAN DEFAULT FALSE,
  url_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active, status);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_place_id ON listings(google_maps_place_id);
CREATE INDEX IF NOT EXISTS idx_listings_data_gin ON listings USING GIN (category_data);
CREATE INDEX IF NOT EXISTS idx_listings_images_gin ON listings USING GIN (image_urls);

DROP TRIGGER IF EXISTS trg_listings_updated ON listings;
CREATE TRIGGER trg_listings_updated
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS listing_reviews (
  id SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id INT NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL,
  reason TEXT,
  changes_requested JSONB,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON listing_reviews(listing_id);
