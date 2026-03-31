# LOL Agent-First Review App (Phase 1)

## 1) Phase 1 scope delivered

- Agent main flow skeleton (`intent -> planning -> tool execution -> summarize`)
- Capability protocol and registry
- Region + account linking abstraction (mock implementation)
- Match import abstraction (mock implementation)
- Basic review engine
- Fixed-structure basic report output
- Shell UI (input / plan / step state / tool summaries / report rendering)
- Entitlement and paid-feature placeholders
- Unit tests with mock data

## 2) Project structure (core)

```text
src/
  agent/
    protocol/agent-protocol.ts
    interpreter/mock-intent-interpreter.ts
    session/session-context-manager.ts
    planner/agent-planner.ts
    planner/mock-task-planner.ts
    executor/agent-executor.ts
    synthesizer/result-synthesizer.ts
    orchestrator/agent-orchestrator.ts
    permissions/permission.service.ts
  capabilities/
    toolkit/types.ts
    toolkit/registry.ts
    toolkit/definitions/*
    toolkit/providers/mock-capability.provider.ts
  domain/
    user/types.ts
    account/types.ts
    match/types.ts
    review/types.ts
    session/types.ts
    entitlement/types.ts
  application/
    use-cases/run-review.use-case.ts
  infrastructure/
    repositories/
      mock-account.repository.ts
      mock-match.repository.ts
      mock-entitlement.repository.ts
    providers/basic-review.engine.ts
  presentation/
    app-shell/app-shell.tsx
    chat-shell/chat-shell.tsx
    status-panels/execution-panel.tsx
    result-renderers/report-renderer.tsx
  main.tsx
  styles.css
test/
  orchestrator.spec.ts
```

## 3) Mock boundary

Phase 1 uses mock implementations for external dependencies:

- Account linking providers (international/cn)
- Match import providers (international/cn)
- Entitlement repository
- Deep review / AI followup / clip review are stubs gated by entitlement

No production-grade third-party API integration is implemented in this phase.

## 4) Capability protocol

Primary protocol for the current main chain is `src/capabilities/toolkit/*`:

- Standardized capability ids, input/output/error schemas
- Unified execution context (`userId`, `region`, `nowIso`, `sessionId`)
- Unified invocation entry via `CapabilityRegistry.invoke`
- All business abilities are agent-invokable via the registry
- Main-chain ids are single naming system:
  - `region.select`
  - `account.link_status`
  - `account.link_mock`
  - `match.list_recent`
  - `match.select_target`
  - `review.generate_basic`
  - `review.generate_deep` (stub)
  - `review.ask_followup` (stub)
  - `review.analyze_clip` (stub)
  - `entitlement.check`
  - `billing.unlock` (stub)

## 5) Agent orchestration

Layered components (backend orchestration):

- Intent Interpreter: `MockIntentInterpreter`
- Task Planner: `MockTaskPlanner`
- Capability Executor: `CapabilityExecutor`
- Result Synthesizer: `ResultSynthesizer`
- Session Context Manager: `SessionContextManager`

Required protocol objects are defined in `src/agent/protocol/agent-protocol.ts`:

- `AgentSession`
- `UserGoal`
- `AgentPlan`
- `PlanStep`
- `CapabilityInvocation`
- `CapabilityResult`
- `AgentFinalResponse`
- `EntitlementCheckResult`

Main path:

1. Natural language input -> `MockIntentInterpreter` -> `UserGoal`
2. `MockTaskPlanner` produces `AgentPlan`
3. `CapabilityExecutor` runs each `PlanStep` by calling toolkit registry capabilities with pre-step entitlement checks
4. `SessionContextManager` records step states, invocations, capability results, entitlement checks
5. `ResultSynthesizer` outputs standardized `AgentFinalResponse` + UI-friendly legacy fields

UI consumes only orchestrator outputs and does not directly orchestrate core business logic.

## 6) Basic report fixed structure

`BasicReviewEngine` always outputs:

- 本局总评
- 输赢关键点
- 玩家问题 Top 3
- 玩家亮点 Top 3
- 下局建议 Top 3

## 7) Local run

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

## 8) Validation checklist (Phase 1)

1. Enter app shell
2. Select region (国际服/国服)
3. Use mock account linking (auto through Agent flow)
4. Input: `帮我复盘最近一把LOL对局`
5. Verify Agent outputs:
   - plan
   - step execution status
   - tool call summaries
   - basic review report
6. Verify paywall placeholders:
   - deep review request returns locked state
   - clip review request returns locked state

## 9) Tests

```bash
npm test
```

Current test coverage includes:

- Basic review closed-loop success path
- Deep review entitlement lock path
- Unknown intent fallback path
- Capability registry + all protocolized capabilities (including stubs)

## 10) Capability Layer (Thread B)

Protocolized capability toolkit is implemented under:

- `src/capabilities/toolkit/types.ts`
- `src/capabilities/toolkit/registry.ts`
- `src/capabilities/toolkit/errors.ts`
- `src/capabilities/toolkit/providers/mock-capability.provider.ts`
- `src/capabilities/toolkit/definitions/*`

Implemented capabilities:

1. `account.link_status`
2. `account.link_mock`
3. `region.select`
4. `match.list_recent`
5. `match.select_target`
6. `review.generate_basic`
7. `entitlement.check`
8. `review.generate_deep` (stub)
9. `review.ask_followup` (stub)
10. `review.analyze_clip` (stub)
11. `billing.unlock` (stub)

Capability registry supports:

- register capability
- query capability
- invoke capability
- read capability metadata (schema + entitlement)

Agent integration example:

- `src/agent/integration/registry-agent-adapter.example.ts`

## 11) Region / Account / Match Import Layer (Thread C)

Region routing model:

- `src/domain/region/types.ts`
- Required fields are modeled:
  - `regionType`
  - `regionKey`
  - `accountSystem`
  - `dataSourceType`
  - `availableCapabilities`

Account linking abstraction:

- Interface: `src/infrastructure/providers/account-linking/account-linking.provider.ts`
- Registry: `src/infrastructure/providers/account-linking/account-linking-provider.registry.ts`
- International mock provider: `src/infrastructure/providers/account-linking/intl/international-account-linking.mock-provider.ts`
- CN mock provider: `src/infrastructure/providers/account-linking/cn/cn-account-linking.mock-provider.ts`

Match import abstraction:

- Interface: `src/infrastructure/providers/match-import/match-import.provider.ts`
- Registry: `src/infrastructure/providers/match-import/match-import-provider.registry.ts`
- International mock provider: `src/infrastructure/providers/match-import/intl/international-match-import.mock-provider.ts`
- CN mock provider: `src/infrastructure/providers/match-import/cn/cn-match-import.mock-provider.ts`
- Supported methods:
  - `listRecentMatches`
  - `getMatchSummary`
  - `getMatchTimeline` (mocked)

Match query + target selection use case:

- `src/application/use-cases/match-import/match-import.use-case.ts`
- Includes:
  - recent match listing
  - target selection (`preferred` first, fallback to `latest`)
  - match bundle loading (summary + detail + timeline)

How to replace mock with real providers:

1. Implement production providers for each region under `infrastructure/providers/account-linking/*` and `infrastructure/providers/match-import/*`.
2. Keep the same provider interfaces so capability and agent layers do not change.
3. Register production providers in `createMockProviderRegistries` replacement factory (or env-based factory).
4. Keep capability IDs and schemas unchanged to preserve agent protocol compatibility.

## 12) Basic Review Engine (Thread D)

A stable, explainable, extensible basic review pipeline is implemented:

- Rule extraction: `src/infrastructure/providers/review-basic/rule-extractor.ts`
- Tag system: `src/infrastructure/providers/review-basic/tag-mapper.ts`
- Suggestion template mapping: `src/infrastructure/providers/review-basic/template-mapper.ts`
- Summary composer (future AI extension point): `src/infrastructure/providers/review-basic/summary-composer.ts`
- Engine orchestration: `src/infrastructure/providers/basic-review.engine.ts`

Review domain model:

- `src/domain/review/types.ts`
- Includes:
  - fixed report sections
  - diagnostics signals
  - issue/highlight tag system
  - suggestion tag outputs

Notes:

- Phase 1 is fully rule-based and deterministic (no random generation).
- Future LLM integration can be added in the summary composer layer while keeping rule/tag outputs stable.

## 13) Frontend Shell UI (Thread E)

Shell-only UI modules:

- App shell container: `src/presentation/app-shell/app-shell.tsx`
- UI state/view-model hook: `src/presentation/app-shell/use-agent-shell.ts`
- Agent chat shell: `src/presentation/chat-shell/chat-shell.tsx`
- Execution panel: `src/presentation/status-panels/execution-panel.tsx`
- Review renderer: `src/presentation/result-renderers/report-renderer.tsx`
- Entitlement gate UI: `src/presentation/result-renderers/entitlement-gate.tsx`
- Session history (simple replay): `src/presentation/chat-shell/session-history.tsx`

UI behavior in phase 1:

- Shows region/account state
- Accepts natural language goal input
- Renders agent plan, step execution, tool summaries
- Renders fixed-structure review cards
- Shows locked states for:
  - 深度复盘
  - AI追问
  - 视频片段分析
- Supports lightweight history replay (select previous run result)

Design constraint:

- Page components do not orchestrate core business logic directly.
- Data comes from agent response (`runReviewUseCase`) and capability results.

## 14) Entitlement & Billing Layer (Thread A / Phase 2)

Implemented models:

- `SubscriptionPlan`
- `UserEntitlement`
- `UsageQuota`
- `PurchaseOrder`
- `PaymentRecord`
- `UnlockRecord`
- `FeatureGate`

Implemented capabilities:

- `entitlement.check`
- `entitlement.explain`
- `usage.consume`
- `unlock.create`
- `unlock.confirm`
- `billing.unlock` (backward-compatible bridge)

Business guarantees:

- Free features (`BASIC_REVIEW`, `BASIC_GROWTH_SUMMARY`) are always available.
- Paid features (`DEEP_REVIEW`, `AI_FOLLOWUP`, `CLIP_REVIEW`) are hard-gated in backend capability runtime.
- Usage is consumed only after successful execution.
- Failed executions do not consume quota.
- Mock payment callback (`unlock.confirm`) refreshes entitlement state immediately.

Schema / migration:

- `migrations/20260330_entitlement_billing_schema.sql`

Mock payment + protocol doc:

- `docs/entitlement-billing-phase2.md`

## 15) Deep Review & Match Follow-up (Thread B / Phase 2)

New capabilities:

- `review.deep.generate`
- `review.deep.get`
- `review.deep.status`
- `review.ask.match`
- `review.ask.suggested_prompts`

Highlights:

- Deep review is generated as structured capability output, not page-side string assembly.
- Match follow-up strictly binds to current match context and cites basic/deep review context.
- Agent can decide:
  - direct answer (basic context sufficient),
  - trigger deep review generation,
  - or return paywall action.
- Deep review cache is reused to avoid duplicate computation.

Detailed protocol:

- `docs/deep-review-ai-followup-phase2.md`

## 16) Video Clip Diagnosis (Thread C / Phase 2)

New capabilities:

- `asset.video.upload`
- `diagnosis.video.create`
- `diagnosis.video.status`
- `diagnosis.video.get`

Highlights:

- Upload and diagnosis are decoupled (async task flow).
- Clip must be short and match-bound.
- Entitlement (`CLIP_REVIEW`) is enforced in capability/runtime layer.
- Result is structured and includes mandatory disclaimers that this is assistive diagnosis.
- Provider abstraction is ready for future real multimodal service.

Detailed protocol:

- `docs/video-clip-diagnosis-phase2.md`

## 17) Frontend Shell (Phase 2 Increment)

Frontend shell now includes:

- Deep review rendering entry and structured section display
- Match follow-up ask panel + suggested questions
- Video clip upload panel + diagnosis result renderer
- Entitlement/feature/quota status banner and gate cards
- Agent task observation panel

Design rule remains: shell consumes structured payload and does not orchestrate core business logic.

Detailed frontend notes:

- `docs/frontend-shell-phase2.md`

## 18) Agent Runtime / Orchestration (Thread D / Phase 2)

Agent runtime is upgraded as the unified entry for paid/free/deep/follow-up/video flows:

- Intent expansion: `BASIC_REVIEW`, `DEEP_REVIEW`, `AI_FOLLOWUP`, `CLIP_REVIEW`, `ENTITLEMENT_VIEW`
- Unified planner + executor orchestration for:
  - `entitlement.*`
  - `review.deep.*`
  - `review.ask.*`
  - `asset.video.*`
  - `diagnosis.video.*`
- Context envelope in session:
  - match context
  - entitlement context
  - asset context
- Structured fallback contract for shell rendering:
  - `SUCCESS`, `PAYWALL`, `PENDING`, `RETRYABLE_ERROR`, `INPUT_REQUIRED`, `ERROR`
- Observability additions:
  - `traceId`
  - `correlationId`
  - runtime/capability/step logs
  - error code mapping for fallback decisions

Detailed protocol and behavior:

- `docs/agent-runtime-phase2.md`


## 19) Phase 3 Real Infrastructure Baseline

Phase 3 starts replacing mock dependencies with real-service-first adapters while preserving abstraction boundaries.

Highlights:

- Real provider mode (`real/mock`) with environment-driven registry factory.
- Real client skeletons for LLM, video, DB, storage, queue, payment.
- Async video diagnosis task boundary with queue-worker skeleton.
- New migration baseline for phase3 persistent tables.
- Runtime config and secret management centralized via env.

Docs:

- `docs/phase3-real-infra.md`
- `.env.example`
- `migrations/20260330_phase3_real_infra_schema.sql`

## 20) App Shell Auth + Tabs (Increment)

Mobile `App.tsx` shell now supports:

- Phone + verification code login (`app/auth/send-code`, `app/auth/login`)
- Auto-register on first login
- First-login profile completion modal (nickname required, avatar optional with default)
- Bottom tabs: 首页 / 数据中心 / 我的
- 我的页面按纵向信息流展示：账号信息 + 战绩列表（英雄头像、KDA、胜负色）
- Bind-account UX: binding modal closes immediately on click, then loading overlay appears

Backend app-shell endpoints are handled in:

- `backend/routes/app-shell-routes.ts`
- `backend/services/app-shell.service.ts`

Persistence migration:

- `migrations/20260331_app_shell_auth_profile.sql`

Version updates/data center source note:

- Current home version-feed is `MOCK_RIOT_FEED` in phase scope.
- Riot official news API is not wired in this increment; the endpoint returns mock updates with explicit source notice.

Capability protocol note (main chain):

- Agent main orchestration still uses the unified toolkit capability registry (`src/capabilities/toolkit/*`) with single capability-id naming.
- This app-shell increment does not bypass or replace review capability flow; it only adds shell login/profile/dashboard surfaces.

## 21) Hero Tab (Data Dragon)

Mobile shell adds a new bottom tab: `英雄`.

Backend endpoints:

- `GET app/heroes?position=ALL|TOP|JUNGLE|MID|ADC|SUPPORT`
- `GET app/heroes/{championId}`

Data source:

- Version list: `https://ddragon.leagueoflegends.com/api/versions.json`
- Champion data: `https://ddragon.leagueoflegends.com/cdn/{version}/data/zh_CN/champion.json`

Notes:

- Hero avatar, passive, spells, and descriptions are from Data Dragon.
- Buff/Nerf tags are inferred by comparing current vs previous version base stats (heuristic), and marked as inferred in `sourceNotice`.
- If latest version list fetch fails, service falls back to a fixed version snapshot and returns neutral change tags.
