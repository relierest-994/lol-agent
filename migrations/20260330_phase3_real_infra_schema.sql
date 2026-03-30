-- Phase 3 real infra schema baseline
-- Target: PostgreSQL 14+

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_analysis_contexts (
  context_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  region TEXT NOT NULL,
  basic_review_generated_at TIMESTAMPTZ,
  deep_review_generated_at TIMESTAMPTZ,
  latest_question_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS deep_review_tasks (
  task_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  status TEXT NOT NULL,
  focus_dimensions JSONB NOT NULL,
  authorization_context JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS deep_review_results (
  result_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS match_conversation_sessions (
  conversation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS match_conversation_messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ref JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS video_clip_assets (
  asset_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS video_diagnosis_tasks (
  task_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  natural_language_question TEXT NOT NULL,
  entitlement_context JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS video_diagnosis_results (
  result_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_processing_jobs (
  job_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  provider_job_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS payment_provider_sessions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_intent_id TEXT NOT NULL,
  checkout_url TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_deep_review_tasks_user_match ON deep_review_tasks(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_video_diagnosis_tasks_user_match ON video_diagnosis_tasks(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_match ON video_clip_assets(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON match_conversation_messages(conversation_id, created_at);
