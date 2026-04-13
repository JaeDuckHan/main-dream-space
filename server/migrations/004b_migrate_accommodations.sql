DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accommodations'
      AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accommodations_old'
      AND c.relkind = 'r'
  ) THEN
    ALTER TABLE accommodations RENAME TO accommodations_old;
  END IF;
END $$;

INSERT INTO listings (
  slug, category, name, name_ko, district, address, lat, lng,
  google_maps_url, google_maps_place_id, thumbnail_url, image_urls, rating, review_count,
  category_data, agoda_url, agoda_hotel_id, booking_url, tripcom_url,
  source, status, is_active, place_id_verified, url_verified, created_at, updated_at
)
SELECT
  a.slug,
  'accommodation'::listing_category_enum,
  a.name,
  a.name_ko,
  COALESCE(a.district, 'unknown'),
  COALESCE(a.address, ''),
  a.lat,
  a.lng,
  COALESCE(
    NULLIF(a.booking_url, ''),
    NULLIF(a.tripcom_url, ''),
    NULLIF(a.agoda_url, ''),
    'https://www.google.com/maps/search/?api=1&query=' || replace(a.name, ' ', '+')
  ),
  'legacy-accommodation-' || a.id::text,
  a.thumbnail_url,
  CASE
    WHEN jsonb_typeof(a.image_urls) = 'array' THEN (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN jsonb_typeof(value) = 'string' THEN jsonb_build_object('url', trim(both '"' FROM value::text), 'source', 'official')
            ELSE value
          END
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(a.image_urls) value
    )
    ELSE '[]'::jsonb
  END,
  a.rating,
  a.review_count,
  jsonb_build_object(
    'subtype', a.type::text,
    'price_min_usd', a.price_min_usd,
    'price_max_usd', a.price_max_usd,
    'price_monthly_usd', a.price_monthly_usd,
    'bedrooms', a.bedrooms,
    'max_guests', a.max_guests,
    'amenities', COALESCE(a.amenities, '[]'::jsonb)
  ),
  a.agoda_url,
  a.agoda_hotel_id,
  a.booking_url,
  a.tripcom_url,
  COALESCE(a.source::text, 'manual'),
  'approved'::listing_status_enum,
  COALESCE(a.is_active, TRUE),
  FALSE,
  FALSE,
  a.created_at,
  a.updated_at
FROM accommodations_old a
WHERE NOT EXISTS (
  SELECT 1
  FROM listings l
  WHERE l.slug = a.slug
);

CREATE OR REPLACE VIEW accommodations AS
SELECT
  l.id,
  l.slug,
  l.name,
  l.name_ko,
  COALESCE((l.category_data->>'subtype')::text, 'hotel') AS type,
  l.district,
  l.address,
  l.lat,
  l.lng,
  NULLIF(l.category_data->>'price_min_usd', '')::int AS price_min_usd,
  NULLIF(l.category_data->>'price_max_usd', '')::int AS price_max_usd,
  NULLIF(l.category_data->>'price_monthly_usd', '')::int AS price_monthly_usd,
  l.rating,
  l.review_count,
  NULLIF(l.category_data->>'bedrooms', '')::smallint AS bedrooms,
  NULLIF(l.category_data->>'max_guests', '')::smallint AS max_guests,
  COALESCE(l.category_data->'amenities', '[]'::jsonb) AS amenities,
  l.thumbnail_url,
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(value) = 'object' THEN value->>'url'
          ELSE trim(both '"' FROM value::text)
        END
      )
      FROM jsonb_array_elements(COALESCE(l.image_urls, '[]'::jsonb)) value
    ),
    '[]'::jsonb
  ) AS image_urls,
  l.agoda_url,
  l.agoda_hotel_id,
  l.booking_url,
  l.tripcom_url,
  CASE
    WHEN l.source IN ('manual', 'real_estate', 'partner_api') THEN l.source::accommodation_source_enum
    ELSE 'manual'::accommodation_source_enum
  END AS source,
  l.is_active,
  l.created_at,
  l.updated_at
FROM listings l
WHERE l.category = 'accommodation'
  AND l.status = 'approved'
  AND l.is_active = TRUE;
