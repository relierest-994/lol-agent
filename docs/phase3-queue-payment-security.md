# Phase 3 Queue, Payment, Config & Security

## Queue Realization

Added persistent local queue runtime with retries and dead-letter handling:

- `src/infrastructure/queue/job-queue.runtime.ts`

Capabilities:

- status lifecycle: `PENDING -> RUNNING -> SUCCEEDED/FAILED/DEAD_LETTER`
- retry with backoff
- max attempts and dead-letter transition
- persistent queue state via `PersistentStateStore`

`QueueClient` now supports runtime mode switching:

- `APP_QUEUE_RUNTIME_MODE=local` -> in-process persistent queue runtime
- `APP_QUEUE_RUNTIME_MODE=http` -> remote queue API

Updated:

- `src/infrastructure/clients/queue/queue-client.ts`

### Covered task types

- deep review generation: `deep_review_generate`
- video diagnosis: `video_diagnosis`
- asset processing: `asset_processing`

## Payment Realization Skeleton

Added payment provider abstraction and callback signature/idempotency skeleton:

- `src/infrastructure/payments/payment-provider.ts`
- `src/infrastructure/payments/payment-signature.ts`
- `src/infrastructure/payments/skeleton-payment.provider.ts`
- `src/application/services/payment-webhook.service.ts`

Includes:

- checkout parameter generation
- webhook signature verification skeleton (HMAC-SHA256)
- callback idempotency persistence
- payment result write-back to entitlement/order state

## Config and Secret Management

Extended runtime config:

- `queueRuntimeMode`
- `paymentWebhookSecret`

Files:

- `src/infrastructure/config/runtime-config.ts`
- `src/infrastructure/config/provider-config.validator.ts`
- `src/infrastructure/config/env-schema.ts`

`env-schema` now validates required secrets in staging/prod.

## Security and Abuse Guard

Implemented:

- upload/auth context check (`context.userId` == input user id)
- paid capability auth consistency checks
- rate limiting for:
  - upload
  - deep review generation
  - AI follow-up
  - diagnosis create
- sensitive log masking in logger (`key/secret/token/password/authorization/signature`)

Files:

- `src/infrastructure/security/rate-limiter.ts`
- `src/infrastructure/observability/logger.ts`
- capability definitions under `src/capabilities/toolkit/definitions/*.ts`

## Tests Added

- `test/job-queue-runtime.spec.ts`
- `test/queue-task-flow.spec.ts`
- `test/payment-webhook-idempotency.spec.ts`
- `test/env-schema.spec.ts`

## Env Additions

Updated `.env.example`:

- `APP_QUEUE_RUNTIME_MODE=local|http`
- `APP_VIDEO_STORAGE_MODE=local|object`
- `PAYMENT_PROVIDER=STRIPE|ALIPAY|WECHAT_PAY`
- `PAYMENT_WEBHOOK_SECRET=...`
