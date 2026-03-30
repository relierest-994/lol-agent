# Agent Runtime Phase 2 (Thread D)

## Scope

This document covers the Agent-runtime layer enhancements for Phase 2:

- intent recognition and plan orchestration for free/paid/deep/follow-up/video flows
- capability dispatch with entitlement-aware gating
- session-level traceability and runtime logs
- async-task and fallback render contracts for shell UI

## Protocol Enhancements

Core protocol is in `src/agent/protocol/agent-protocol.ts`.

### Added Context Envelope

`AgentSession` now carries structured runtime context:

- `matchContext`
- `entitlementContext`
- `assetContext`

This allows planner/executor/frontend shell to consume one source of truth.

### Added Traceability

Each session now includes:

- `traceId`
- `correlationId`
- `runtimeLogs[]`

`runtimeLogs` records task-level and capability-level lifecycle events.

### Added Render Payload Contract

Unified render contract (`AgentRenderPayload`) supports:

- `SUCCESS`
- `PAYWALL`
- `PENDING`
- `RETRYABLE_ERROR`
- `INPUT_REQUIRED`
- `ERROR`

This contract is returned in orchestrator output and final response.

## Planner / Orchestrator

### Intent Coverage

`MockIntentInterpreter` now recognizes:

- `BASIC_REVIEW`
- `DEEP_REVIEW`
- `AI_FOLLOWUP`
- `CLIP_REVIEW`
- `ENTITLEMENT_VIEW`
- `UNKNOWN`

### Capability Scheduling

`MockTaskPlanner` routes to capability chains under unified plan:

- `entitlement.*`
- `review.deep.*`
- `review.ask.*`
- `asset.video.*`
- `diagnosis.video.*`

`AgentOrchestrator` injects `traceId/correlationId` into capability context.

## Execution / Fallback Strategy

Implemented in `src/agent/executor/agent-executor.ts`.

### Centralized Entitlement Gate

Before each capability step, executor checks entitlement through `PermissionService`.
When denied, executor returns structured `PAYWALL` payload and stops chain execution.

### Async Task Behavior

Video diagnosis status handling:

- `PENDING` / `RUNNING` => return `PENDING` render payload with polling hint
- `FAILED` => return `RETRYABLE_ERROR`
- `COMPLETED` => continue to result fetch and success payload

### Error/Fallback Mapping

Agent-level error codes:

- `PAYWALL_REQUIRED`
- `TASK_PENDING`
- `PROVIDER_RETRYABLE`
- `CONTEXT_INCOMPLETE`
- `VIDEO_ASSET_INVALID`
- `CAPABILITY_FAILED`
- `UNKNOWN_INTENT`

Fallbacks:

- permission denied -> `PAYWALL`
- missing required context -> `INPUT_REQUIRED`
- provider retryable failure -> `RETRYABLE_ERROR`
- async running -> `PENDING`

## Observability

`SessionContextManager` now logs:

- session creation / goal bound / plan bound
- step running / done / failed
- capability called / completed
- entitlement checked
- paywall/pending/retry/input-required returns
- final summary synthesized

All logs include `traceId` and `correlationId`.

## Tests

New runtime-focused coverage in:

- `test/agent-runtime-thread.spec.ts`

Scenarios:

- intent -> planning -> execution with logs and trace ids
- paywall branch
- deep-review cache reuse
- missing-input fallback
- retryable video provider failure

Also updated:

- `test/orchestrator.spec.ts`

to align with render payload contract assertions.

