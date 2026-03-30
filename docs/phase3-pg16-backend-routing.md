# Phase 3 PG16 & Backend DB Routing

## What changed

1. Frontend/runtime no longer holds direct DB endpoint/key configuration.
2. DB checks in capability runtime are routed through backend API (`API_BASE_URL`) instead of direct DB gateway calls.
3. Added PG16 backend config loader/validator:
   - `src/infrastructure/config/pg16-config.ts`
4. Video diagnosis provider now has an independent model config:
   - `VITE_VIDEO_LLM_MODEL` / `VIDEO_LLM_MODEL`

## Why

- Keep Agent-First boundary: frontend shell and capability runtime should not connect to DB directly.
- Ensure DB access is always controlled by backend service (auth/audit/rate-limit).
- Allow video diagnosis to evolve with a dedicated multimodal model independently from text LLM.

## Backend DB health contract

Frontend/runtime expects backend to expose:

- `GET /infra/db/health`
  - example response:
    - `ok: boolean`
    - `engine: "postgres"`
    - `version: "16.x"`
    - `latency_ms: number`

This endpoint is optional for business continuity; if unavailable, basic review generation still proceeds.

