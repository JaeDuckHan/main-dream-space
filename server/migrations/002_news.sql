USE dreamspace;

CREATE TABLE IF NOT EXISTS news_articles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  notion_id     VARCHAR(100) UNIQUE,
  title         VARCHAR(500) NOT NULL,
  summary       TEXT,
  content       LONGTEXT,
  category      VARCHAR(50) DEFAULT '한달살기 팁',
  image_url     VARCHAR(1000),
  image_credit  VARCHAR(500),
  source_name   VARCHAR(200),
  source_url    VARCHAR(1000),
  slug          VARCHAR(220) UNIQUE,
  publish_slot  ENUM('morning','afternoon') DEFAULT 'morning',
  published_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_published_at (published_at DESC),
  INDEX idx_category (category),
  INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
