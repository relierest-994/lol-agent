# Deep Review & Match Follow-up (Phase 2)

## New Data Models

- `DeepReviewTask`
- `DeepReviewResult`
- `MatchAnalysisContext`
- `ReviewInsight`
- `ReviewEvidence`
- `ReviewSuggestion`
- `MatchConversationSession`
- `MatchConversationMessage`

All models are defined in `src/domain/review/types.ts`.

## Capability Protocol

### `review.deep.generate`
- Input:
  - `user_id`
  - `match_id`
  - `region`
  - `account_id`
  - `focus_dimensions?`
  - `authorization_context`
- Output:
  - `status`
  - `dimensions`
  - `structured_insights`
  - `evidence_list`
  - `suggestion_list`
  - `render_payload`
  - `cached`

### `review.deep.get`
- Returns cached deep review result for `user_id + match_id`.

### `review.deep.status`
- Returns task status for `user_id + match_id`.

### `review.ask.match`
- Input:
  - `user_id`
  - `match_id`
  - `region`
  - `question`
  - `authorization_context`
- Output:
  - `status` (`ANSWERED | NEEDS_DEEP_REVIEW | PAYWALL_REQUIRED`)
  - `answer` (structured payload)
  - `cited_from`
  - `paywall_action`
  - `suggested_prompts`

### `review.ask.suggested_prompts`
- Returns recommended next questions based on current match context and deep-review availability.

## Agent Decision Rules

1. If question can be answered using current match + basic review context:
   - directly answer via `review.ask.match`.
2. If question needs deep context and cache is missing:
   - plan deep review generation (`review.deep.generate`).
3. If capability is locked:
   - return structured paywall action (no generic fallback chat).
4. If deep result exists:
   - prioritize cache reuse (`review.deep.get`) to avoid duplicate generation.

## Output Structure (UI-ready)

Each deep insight includes:
- `section_title`
- `severity`
- `insight`
- `evidence`
- `advice`
- `tags`
- `related_timestamp`

This is exposed both in `structured_insights` and `render_payload.sections`.
