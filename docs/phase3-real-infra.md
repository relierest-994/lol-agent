# Phase 3 Real Infrastructure Upgrade

## Overview

Phase 3 upgrades key runtime dependencies from mock-only to real-service-first integration while keeping provider/capability abstractions stable.

## What was added

1. Real provider switch
- `createCapabilityRegistry(mode?)` now supports `real | mock`.
- Default mode is loaded from env (`VITE_APP_PROVIDER_MODE`, default `real`).
- `allowMockFallback` enables local fallback for missing infra.

2. Runtime config and secrets
- Centralized config: `src/infrastructure/config/runtime-config.ts`.
- No provider keys are hardcoded in source.
- `.env.example` added with all required variables.

3. Real client skeletons
- HTTP client with retry/timeout: `src/infrastructure/clients/http-client.ts`.
- LLM client: `src/infrastructure/clients/llm/llm-client.ts`.
- Video provider client: `src/infrastructure/clients/video/video-provider-client.ts`.
- Storage client (presigned upload flow): `src/infrastructure/clients/storage/storage-client.ts`.
- Queue client: `src/infrastructure/clients/queue/queue-client.ts`.
- Payment client: `src/infrastructure/clients/payment/payment-client.ts`.
- DB health is now routed through backend API gateway (`GET /infra/db/health`), no direct frontend DB endpoint/key config.

4. Real capability provider
- New `RealCapabilityProvider` added at:
  - `src/capabilities/toolkit/providers/real-capability.provider.ts`
- Integrates real HTTP/LLM/video/storage/queue/payment/db skeletons.
- Keeps mock fallback path for local development.
- Adds provider config validation on startup (`validateProviderConfig`).
- Uses normalized provider error mapping (`provider-error.mapper`) for structured logs.

5. LLM real provider chain
- Prompt builder:
  - `src/infrastructure/providers/llm/prompts/deep-review.prompt.ts`
  - `src/infrastructure/providers/llm/prompts/match-ask.prompt.ts`
- Provider wrapper:
  - `src/infrastructure/providers/llm/text-generation.provider.ts`
- Response normalization:
  - `src/infrastructure/providers/llm/response-normalizer.ts`
- Reliability controls:
  - timeout/retry via shared `HttpClient`
  - in-flight dedupe window (15s) for identical deep review / ask calls
  - request id + trace id header passthrough (`x-client-request-id`, `x-trace-id`)

6. Video diagnosis real provider chain
- Provider request builder:
  - `src/infrastructure/providers/video-diagnosis/provider-request.builder.ts`
- Real provider wrapper:
  - `src/infrastructure/providers/video-diagnosis/real-video-diagnosis.provider.ts`
- Provider response parser:
  - `src/infrastructure/providers/video-diagnosis/provider-response.parser.ts`
- Async diagnosis still handled through queue boundary, but now with normalized provider parse/output.

7. Video diagnosis async boundary
- `diagnosis.video.create` now enqueues task semantics and no longer executes diagnosis inline.
- Worker skeleton added:
  - `src/workers/video-diagnosis.worker.ts`

8. Payment naming upgrade in UI/use-case
- Added generic use-cases: `createOrder`, `confirmPayment`.
- UI switched to generic naming (no mock wording by default).

9. DB migration baseline
- `migrations/20260330_phase3_real_infra_schema.sql` introduces phase3 tables:
  - deep review tasks/results
  - conversation messages
  - video assets/tasks/results
  - asset processing jobs
  - payment sessions + webhook events

## Environment variables

See `.env.example`.

Key groups:
- provider mode
- API gateway
- LLM
- video provider
- storage
- queue
- payment
- backend PG16 (server-side env only)

## Local / staging behavior

- Local recommended:
  - `VITE_APP_PROVIDER_MODE=real`
  - `VITE_APP_ALLOW_MOCK_FALLBACK=true`
- Staging/production recommended:
  - `VITE_APP_PROVIDER_MODE=real`
  - `VITE_APP_ALLOW_MOCK_FALLBACK=false`

## Error handling and observability

- HTTP clients support timeout + retry.
- Provider errors logged through `src/infrastructure/observability/logger.ts`.
- Agent runtime still emits `traceId` and `correlationId` in session logs.
- Provider request-level ids are propagated to upstream providers via headers.

## Test coverage added

- `test/phase3-provider-switching.spec.ts`
  - validates real/mock registry factories and generic factory behavior.
- `test/http-client-reliability.spec.ts`
  - timeout/retry behavior for shared HTTP client.
- `test/provider-error.mapper.spec.ts`
  - provider error normalization behavior.
- `test/llm-response-normalizer.spec.ts`
  - LLM structured parse + malformed response protection.
- `test/video-provider-parser.spec.ts`
  - multimodal provider response parsing.
- `test/text-generation.provider.spec.ts`
  - in-flight dedupe for repeated LLM requests.
- `test/real-provider-fallback.spec.ts`
  - degrade path when real infra is unavailable and fallback is enabled.

## TODO / Remaining integration tasks

1. Replace `accounts/*` and `matches/*` real endpoints from mock gateway to actual game-provider services.
2. Implement persistent DB repository adapters (PostgreSQL driver layer) instead of DB HTTP gateway proxy.
3. Wire queue worker to real queue consumer runtime (e.g. BullMQ/SQS worker process).
4. Implement real payment webhook signature verification and idempotency table writes.
5. Implement storage upload callback (virus scan/transcode pipeline) and signed-download flow.
6. Add integration tests against staging sandbox services (LLM/video/payment/queue).
7. Remove temporary fallback in production by setting `VITE_APP_ALLOW_MOCK_FALLBACK=false`.
