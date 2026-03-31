-- Phase 4 app-shell auth/profile/dashboard persistence
-- Date: 2026-03-31

CREATE TABLE IF NOT EXISTS app_users (
  user_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  nickname TEXT,
  avatar_url TEXT NOT NULL,
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_phone ON app_users(phone);

CREATE TABLE IF NOT EXISTS app_login_codes (
  request_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_login_codes_phone_created_at
  ON app_login_codes(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS app_user_sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_user_sessions_user_id ON app_user_sessions(user_id);

CREATE TABLE IF NOT EXISTS app_user_game_accounts (
  user_id TEXT NOT NULL REFERENCES app_users(user_id),
  region TEXT NOT NULL,
  account_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  tag_line TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, region)
);

