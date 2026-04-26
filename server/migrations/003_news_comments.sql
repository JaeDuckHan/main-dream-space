CREATE TABLE IF NOT EXISTS news_comments (
  id          SERIAL PRIMARY KEY,
  article_id  INT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_article ON news_comments (article_id, created_at DESC);
