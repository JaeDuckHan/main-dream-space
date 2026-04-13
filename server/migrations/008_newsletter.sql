CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  source VARCHAR(50) NOT NULL DEFAULT 'main',
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  locale VARCHAR(10) NOT NULL DEFAULT 'ko',
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_created ON newsletter_subscribers(created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_rate_limit (
  ip_hash VARCHAR(64) PRIMARY KEY,
  last_try TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
