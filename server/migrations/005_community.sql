DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_category_enum') THEN
    CREATE TYPE community_category_enum AS ENUM ('notice', 'question', 'review', 'info');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stay_type_enum') THEN
    CREATE TYPE stay_type_enum AS ENUM ('monthly_stay', 'long_term', 'retirement', 'workation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coffee_chat_status_enum') THEN
    CREATE TYPE coffee_chat_status_enum AS ENUM ('open', 'full', 'cancelled', 'completed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category community_category_enum NOT NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_category_created ON community_posts(category, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON community_posts(is_pinned DESC, created_at DESC) WHERE is_deleted = FALSE;
DROP TRIGGER IF EXISTS trg_posts_updated ON community_posts;
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS community_comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id INT REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_id IS NULL OR parent_id != id)
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON community_comments(parent_id) WHERE is_deleted = FALSE;
DROP TRIGGER IF EXISTS trg_comments_updated ON community_comments;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS community_likes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(10) NOT NULL,
  target_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id),
  CHECK (target_type IN ('post', 'comment'))
);
CREATE INDEX IF NOT EXISTS idx_likes_target ON community_likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON community_likes(user_id);

CREATE TABLE IF NOT EXISTS community_bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON community_bookmarks(user_id);

CREATE TABLE IF NOT EXISTS community_images (
  id SERIAL PRIMARY KEY,
  uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES community_posts(id) ON DELETE SET NULL,
  url VARCHAR(1000) NOT NULL,
  relative_path VARCHAR(500) NOT NULL,
  file_size_bytes INT,
  mime_type VARCHAR(50),
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_images_post ON community_images(post_id);
CREATE INDEX IF NOT EXISTS idx_images_orphan ON community_images(created_at) WHERE post_id IS NULL;

ALTER TABLE community_images
  ADD COLUMN IF NOT EXISTS relative_path VARCHAR(500);

UPDATE community_images
SET relative_path = regexp_replace(url, '^https?://[^/]+/uploads/', '')
WHERE relative_path IS NULL
  AND url ~ '^https?://[^/]+/uploads/';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_images'
      AND column_name = 'relative_path'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1
    FROM community_images
    WHERE relative_path IS NULL
  ) THEN
    ALTER TABLE community_images
      ALTER COLUMN relative_path SET NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS coffee_chats (
  id SERIAL PRIMARY KEY,
  organizer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  meetup_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 120,
  location_name VARCHAR(200),
  location_detail TEXT,
  location_map_url VARCHAR(500),
  max_participants INT NOT NULL DEFAULT 10,
  current_participants INT NOT NULL DEFAULT 1,
  status coffee_chat_status_enum NOT NULL DEFAULT 'open',
  target_groups JSONB,
  age_range VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chats_meetup_open ON coffee_chats(meetup_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_chats_organizer ON coffee_chats(organizer_id);
DROP TRIGGER IF EXISTS trg_chats_updated ON coffee_chats;
CREATE TRIGGER trg_chats_updated BEFORE UPDATE ON coffee_chats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS coffee_chat_participants (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES coffee_chats(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  note TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, user_id),
  CHECK (status IN ('confirmed', 'cancelled', 'no_show'))
);

CREATE TABLE IF NOT EXISTS residents (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  age_group VARCHAR(20),
  stay_type stay_type_enum NOT NULL,
  area VARCHAR(100),
  stay_from DATE NOT NULL,
  stay_to DATE,
  bio TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_residents_active ON residents(stay_from, stay_to) WHERE is_public = TRUE;
DROP TRIGGER IF EXISTS trg_residents_updated ON residents;
CREATE TRIGGER trg_residents_updated BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS community_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL,
  target_id INT NOT NULL,
  reason VARCHAR(50) NOT NULL,
  detail TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  resolved_by INT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (target_type IN ('post', 'comment', 'user')),
  CHECK (reason IN ('spam', 'abuse', 'inappropriate', 'other')),
  CHECK (status IN ('pending', 'resolved', 'dismissed'))
);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON community_reports(status, created_at DESC);

CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_deleted = FALSE THEN
    UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = NEW.post_id;
    ELSIF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_count ON community_comments;
CREATE TRIGGER trg_comment_count
  AFTER INSERT OR UPDATE OR DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.target_type = 'post' THEN
    UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
  ELSIF TG_OP = 'DELETE' AND OLD.target_type = 'post' THEN
    UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.target_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_like_count ON community_likes;
CREATE TRIGGER trg_post_like_count
  AFTER INSERT OR DELETE ON community_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();
