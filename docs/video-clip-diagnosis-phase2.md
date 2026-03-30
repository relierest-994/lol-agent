# Video Clip Diagnosis (Phase 2)

## Scope and Constraints

- Single short clip only (not full match recording).
- Must be bound to an existing `match_id`.
- Requires user natural language question.
- Defaults:
  - max duration: `60s`
  - recommended duration: `10-30s`
  - max file size: `50MB` (configurable)
  - formats: `mp4`, `mov`, `webm`
- Explicit disclaimer: diagnosis is assistive, not absolute frame-by-frame adjudication.

## Data Models

Defined in `src/domain/video/types.ts`:

- `VideoClipAsset`
- `VideoDiagnosisTask`
- `VideoDiagnosisResult`
- `MultimodalInputContext`
- `AssetProcessingJob`

## Capability Protocol

- `asset.video.upload`
  - validates format/size/duration/match binding
  - persists asset and processing job status
- `diagnosis.video.create`
  - checks entitlement and context
  - creates async diagnosis task
- `diagnosis.video.status`
  - task polling endpoint/capability
- `diagnosis.video.get`
  - structured diagnosis output for rendering

## Layered Architecture

- Preprocessor: `video-asset.preprocessor.ts`
- Context builder: `multimodal-context.builder.ts`
- Diagnosis provider interface: `diagnosis.provider.ts`
- Mock provider: `mock-video-diagnosis.provider.ts`
- Normalizer: `result-normalizer.ts`
- Service orchestrator: `video-diagnosis.service.ts`

This keeps controller/capability thin and allows provider swap for real multimodal model later.

## Structured Output

Diagnosis result includes:

- `overall_judgement`
- `likely_issue_types`
- `key_moments`
- `positional_or_trade_error`
- `execution_or_decision_hints`
- `next_action_advice`
- `structured_findings`
- `confidence_hints`
- `recommended_next_questions`
- `disclaimers`
- `render_payload`

## Agent Integration

- Agent intent detects clip-diagnosis requests.
- Planner schedules:
  - upload
  - create task
  - status
  - get result
- Executor binds task to selected match context and user question.
- Result is written back to agent response (`videoDiagnosis`) and remains context-bound.
