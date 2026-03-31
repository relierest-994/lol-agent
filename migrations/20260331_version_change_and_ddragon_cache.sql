-- Phase 2: version change reports and Data Dragon cache
-- Created at: 2026-03-31

CREATE TABLE IF NOT EXISTS public.app_version_change_reports (
  version TEXT PRIMARY KEY,
  previous_version TEXT,
  report_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_version_change_reports_updated_at
  ON public.app_version_change_reports (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.app_ddragon_payload_cache (
  cache_type TEXT NOT NULL,
  version TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cache_type, version)
);

CREATE INDEX IF NOT EXISTS idx_app_ddragon_payload_cache_updated_at
  ON public.app_ddragon_payload_cache (updated_at DESC);
