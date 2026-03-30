-- Phase 3 DB/storage extension
-- Adds missing persistence tables for account binding, match import/basic review,
-- entitlement/order domain state, and agent runtime task status.

CREATE TABLE IF NOT EXISTS linked_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  region TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  tag_line TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, region)
);

CREATE TABLE IF NOT EXISTS imported_match_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  region TEXT NOT NULL,
  account_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, region, match_id)
);

CREATE TABLE IF NOT EXISTS basic_review_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS user_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_quotas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  period_type TEXT NOT NULL,
  total_units INTEGER NOT NULL,
  used_units INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  source_ref_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  feature_code TEXT,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS unlock_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  status TEXT NOT NULL,
  source_order_id TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_task_runs (
  task_run_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  trace_id TEXT,
  correlation_id TEXT,
  intent TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_region ON linked_accounts(user_id, region);
CREATE INDEX IF NOT EXISTS idx_imported_matches_user_match ON imported_match_summaries(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_basic_review_user_match ON basic_review_reports(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_runs_session ON agent_task_runs(session_id, updated_at);

CREATE TABLE IF NOT EXISTS persistent_state_kv (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, key)
);
