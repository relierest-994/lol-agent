# Phase 3 Backend Ops (PG16 / Provider / Queue / Payment)

## 1) Runtime boundary

- Frontend shell only uses:
  - `VITE_API_BASE_URL`
  - `VITE_REQUEST_TIMEOUT_MS`
  - `VITE_REQUEST_RETRIES`
- All business integrations (LLM, multimodal diagnosis, upload/storage, queue, payment callback, DB) must run in backend.

## 2) Backend startup command

This repository currently contains frontend + capability runtime code and expects a separate backend service behind `API_BASE_URL`.

Recommended backend start command pattern:

```bash
APP_ENV=dev APP_PROVIDER_MODE=real node server/index.js
```

If your backend uses framework CLI, equivalent examples:

```bash
# NestJS
APP_ENV=dev APP_PROVIDER_MODE=real npm run start:dev

# Fastify (ts-node)
APP_ENV=dev APP_PROVIDER_MODE=real npm run backend:dev
```

## 3) PG16 migration scheme

1. Provision PostgreSQL 16.
2. Create database and app role.
3. Execute migrations in order:
   - `migrations/20260330_entitlement_billing_schema.sql`
   - `migrations/20260330_phase3_real_infra_schema.sql`
   - `migrations/20260330_phase3_db_storage_extension.sql`
4. Verify core tables and indexes.

Example:

```bash
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_entitlement_billing_schema.sql
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_phase3_real_infra_schema.sql
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_phase3_db_storage_extension.sql
```

## 4) Login providers before review flow

- Riot and Wegame auth/config are backend-only.
- Backend should enforce linked-account presence before importing matches/review tasks.
- Config parser/validator:
  - `src/infrastructure/config/game-provider-config.ts`

