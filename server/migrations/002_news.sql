-- 다낭 생활뉴스 테이블 (PostgreSQL / dreamspace DB)
CREATE TABLE IF NOT EXISTS news_articles (
  id            SERIAL PRIMARY KEY,
  notion_id     VARCHAR(100) UNIQUE,
  title         VARCHAR(500) NOT NULL,
  summary       TEXT,
  content       TEXT,
  category      VARCHAR(50) DEFAULT '기타',
  image_url     VARCHAR(1000),
  image_credit  VARCHAR(500),
  source_name   VARCHAR(200),
  source_url    VARCHAR(1000),
  slug          VARCHAR(220) UNIQUE,
  publish_slot  VARCHAR(10) DEFAULT 'morning' CHECK (publish_slot IN ('morning','afternoon')),
  published_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category     ON news_articles (category);
CREATE INDEX IF NOT EXISTS idx_news_slug         ON news_articles (slug);
