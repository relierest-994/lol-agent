-- Phase 2: Entitlement / Billing / Quota / Unlock schema (mock-first, production-ready shape)

CREATE TABLE subscription_plan (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  duration_days INTEGER,
  feature_codes TEXT NOT NULL,
  quota_policy_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_entitlement (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_user_entitlement_user_feature ON user_entitlement(user_id, feature_code);

CREATE TABLE usage_quota (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  period_type TEXT NOT NULL,
  total_units INTEGER NOT NULL,
  used_units INTEGER NOT NULL,
  status TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  reset_at TEXT,
  source_ref_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_usage_quota_user_feature ON usage_quota(user_id, feature_code);

CREATE TABLE purchase_order (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  feature_code TEXT,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  fulfilled_at TEXT
);
CREATE INDEX idx_purchase_order_user ON purchase_order(user_id);

CREATE TABLE payment_record (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX idx_payment_record_order ON payment_record(order_id);

CREATE TABLE unlock_record (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  status TEXT NOT NULL,
  source_order_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT
);
CREATE INDEX idx_unlock_record_user_feature ON unlock_record(user_id, feature_code);

CREATE TABLE feature_gate (
  feature_code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_free INTEGER NOT NULL,
  default_quota_json TEXT,
  recommended_plan_codes TEXT NOT NULL
);
