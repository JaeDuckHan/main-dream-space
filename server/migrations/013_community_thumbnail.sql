-- server/migrations/013_community_thumbnail.sql
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
