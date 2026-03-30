# Phase3 Frontend Realtime Integration

## Scope

This document describes the frontend shell adaptation from mock-first rendering to real-service-compatible rendering in an Agent-First workflow.

## What Changed

### 1. Realtime state adaptation

Updated `useAgentShell` to support:

- Basic review loading, success and failure rendering.
- Deep review task observation (`PENDING/RUNNING/COMPLETED/FAILED`).
- AI follow-up answer status with structured render payload awareness.
- Video upload + diagnosis task observation (`PENDING/RUNNING/COMPLETED/FAILED`).
- Entitlement loading/error handling and refresh.
- Payment flow UI state machine (`CREATING_ORDER -> AWAITING_PAYMENT -> CONFIRMING -> SUCCESS/FAILED`).

Key file:

- `src/presentation/app-shell/use-agent-shell.ts`

### 2. Async polling / task observer layer

Added a shell adapter that polls capability endpoints and normalizes result payloads for UI consumption:

- `pollDeepReviewTask`
- `pollVideoDiagnosisTask`

It advances local queue runtime during polling to reflect async progress in local/stubbed environments.

Key file:

- `src/presentation/app-shell/agent-shell-runtime.ts`

### 3. Error and degrade rendering

UI now consumes structured state/error instead of string guessing:

- `PAYWALL`, `PENDING`, `RETRYABLE_ERROR`, `INPUT_REQUIRED`, `ERROR` render states mapped to alerts.
- Provider unavailable/timeout now displayed through structured alert cards.
- Task-level failure messages shown in deep review / diagnosis panels.

Updated files:

- `src/presentation/app-shell/app-shell.tsx`
- `src/presentation/result-renderers/deep-review-section-renderer.tsx`
- `src/presentation/result-renderers/diagnosis-result-renderer.tsx`
- `src/presentation/status-panels/agent-task-status-panel.tsx`
- `src/presentation/status-panels/entitlement-status-banner.tsx`
- `src/presentation/chat-shell/video-upload-panel.tsx`

### 4. Upload + payment integration behavior

Frontend now supports:

- Order creation + checkout creation (payment skeleton path).
- Explicit callback confirmation action for non-production callback simulation.
- Entitlement refresh after payment confirmation.

## Tests Added/Updated

### New

- `test/frontend-realtime-adapter.spec.ts`
  - Polling chain for deep review and video diagnosis.
  - Payment checkout + confirmation -> entitlement refresh.

### Updated

- `test/ui-shell.spec.tsx`
  - Realtime shell rendering regression.
  - Error/loading UI states for entitlement and diagnosis.

## Validation

Executed:

- `npm run build`
- `npm test`

Both pass.
