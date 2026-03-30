# Frontend Shell Phase 2

## Principles

- Agent-First remains unchanged.
- Frontend shell only handles:
  - input
  - confirmation
  - observation
  - structured rendering
- No business orchestration is implemented in page components.

## New UI Components

- `ReviewSummaryCard`
- `DeepReviewSectionRenderer`
- `CapabilityGateCard`
- `EntitlementStatusBanner`
- `MatchAskPanel`
- `SuggestedQuestionList`
- `VideoUploadPanel`
- `DiagnosisResultRenderer`
- `AgentTaskStatusPanel`

## State Management Updates

`use-agent-shell.ts` now includes:

- deep review action (`runDeepReview`)
- match ask action (`runFollowupAsk`)
- clip diagnosis action (`runVideoDiagnosis`)
- clip draft state (`file_name`, `mime_type`, `size_bytes`, `duration_seconds`)
- question draft states and suggested follow-up list
- entitlement refresh after each run and mock purchase

## API / Capability Adaptation

Shell uses existing `runReviewUseCase` and consumes structured payloads:

- basic review: `report`
- deep review: `deepReview`
- ask: `followupAnswer`
- clip diagnosis: `videoDiagnosis`

## UI Behavior

- loading: `running` state drives button/placeholder state
- task observation: `AgentTaskStatusPanel`
- retry: user can rerun by clicking the same action button
- paywall/lock state: rendered from `lockedInfo` and entitlement payloads
