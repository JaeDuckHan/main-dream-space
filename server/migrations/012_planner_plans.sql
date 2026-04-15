-- server/migrations/012_planner_plans.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS planner_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_plans_session ON planner_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_planner_plans_public ON planner_plans(is_public, created_at DESC) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS planner_reminders (
  id SERIAL PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_reminders_pending ON planner_reminders(remind_at) WHERE sent = false;
