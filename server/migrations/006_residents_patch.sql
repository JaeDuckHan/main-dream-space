ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS use_custom_avatar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio_summary VARCHAR(80),
  ADD COLUMN IF NOT EXISTS contact_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS interests JSONB;

COMMENT ON COLUMN residents.avatar_url IS 'Custom uploaded avatar used when use_custom_avatar is true';
COMMENT ON COLUMN residents.bio_summary IS 'Short resident intro shown in cards/sidebar';
COMMENT ON COLUMN residents.contact_method IS 'Resident contact preference';

ALTER TABLE residents
  DROP CONSTRAINT IF EXISTS residents_contact_method_check;

ALTER TABLE residents
  ADD CONSTRAINT residents_contact_method_check
  CHECK (contact_method IS NULL OR contact_method IN ('coffee_chat', 'post_only', 'none'));

UPDATE residents
SET interests = '[]'::jsonb
WHERE interests IS NULL;

ALTER TABLE residents
  ALTER COLUMN interests SET DEFAULT '[]'::jsonb;

CREATE OR REPLACE VIEW residents_public AS
SELECT
  r.id,
  r.user_id,
  r.nickname,
  r.age_group,
  r.stay_type,
  r.area,
  r.stay_from,
  r.stay_to,
  r.bio,
  r.bio_summary,
  COALESCE(r.interests, '[]'::jsonb) AS interests,
  COALESCE(r.contact_method, 'post_only') AS contact_method,
  CASE
    WHEN r.use_custom_avatar AND r.avatar_url IS NOT NULL THEN r.avatar_url
    ELSE u.avatar_url
  END AS display_avatar,
  u.display_name AS oauth_name,
  r.created_at,
  r.updated_at,
  (r.stay_from <= CURRENT_DATE AND (r.stay_to IS NULL OR r.stay_to >= CURRENT_DATE)) AS is_active
FROM residents r
JOIN users u ON u.id = r.user_id
WHERE r.is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_residents_stay_type ON residents(stay_type) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_residents_area ON residents(area) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_residents_active_range ON residents(stay_from, stay_to) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS resident_profile_views (
  id BIGSERIAL PRIMARY KEY,
  resident_id INT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  viewer_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_resident ON resident_profile_views(resident_id, viewed_at DESC);
