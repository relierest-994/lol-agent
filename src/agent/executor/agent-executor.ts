import type { CapabilityExecutionContext, CapabilityId } from '../../capabilities/toolkit';
import type { CapabilityRegistry } from '../../capabilities/toolkit/registry';
import type {
  BasicReviewReport,
  DeepReviewResult,
  EntitlementFeature,
  LinkedAccount,
  MatchAskAnswer,
  MatchSummary,
  VideoDiagnosisResult,
} from '../../domain';
import { getLocalJobQueueRuntime } from '../../infrastructure/queue/job-queue.runtime';
import type {
  AgentErrorCode,
  AgentPlan,
  AgentRenderPayload,
  AgentSession,
  PlanStep,
} from '../protocol/agent-protocol';
import { PermissionService } from '../permissions/permission.service';
import { SessionContextManager } from '../session/session-context-manager';

export interface ToolCallSummary {
  capability: CapabilityId;
  summary: string;
  ok: boolean;
}

interface ExecutorState {
  linkedAccount?: LinkedAccount;
  matches: MatchSummary[];
  selectedMatchId?: string;
  report?: BasicReviewReport;
  deepReview?: DeepReviewResult;
  followupAnswer?: MatchAskAnswer['answer'];
  uploadedAssetId?: string;
  diagnosisTaskId?: string;
  videoDiagnosis?: VideoDiagnosisResult;
  lockedInfo?: string;
  error?: string;
  errorCode?: AgentErrorCode;
  renderPayload?: AgentRenderPayload;
}

export interface UploadedClipInput {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
}

export interface AgentExecutionOutput {
  session: AgentSession;
  toolCalls: ToolCallSummary[];
  report?: BasicReviewReport;
  deepReview?: DeepReviewResult;
  followupAnswer?: MatchAskAnswer['answer'];
  videoDiagnosis?: VideoDiagnosisResult;
  lockedInfo?: string;
  error?: string;
  errorCode?: AgentErrorCode;
  renderPayload: AgentRenderPayload;
}

interface StepResult {
  ok: boolean;
  summary: string;
  error?: string;
  errorCode?: AgentErrorCode;
  retryable?: boolean;
  lockedInfo?: string;
  paywall?: {
    reason_code: string;
    display_message: string;
    paywall_payload?: import('../../domain').PaywallPayload;
    feature_code?: EntitlementFeature;
    remaining_quota?: number;
  };
  pending?: {
    status: 'PENDING' | 'RUNNING';
    poll_hint_seconds: number;
  };
  requiredInputs?: string[];
  data?: unknown;
}

export class CapabilityExecutor {
  private readonly permissionService: PermissionService;

  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly sessionManager: SessionContextManager
  ) {
    this.permissionService = new PermissionService(registry);
  }

  async executePlan(
    session: AgentSession,
    plan: AgentPlan,
    context: CapabilityExecutionContext,
    inputAccount?: LinkedAccount,
    uploadedClip?: UploadedClipInput
  ): Promise<AgentExecutionOutput> {
    const toolCalls: ToolCallSummary[] = [];
    const state: ExecutorState = {
      linkedAccount: inputAccount,
      matches: [],
    };

    if (uploadedClip) {
      this.sessionManager.updateAssetContext(session, {
        uploadedClip,
      });
    }

    for (const step of plan.steps) {
      const entitlement = await this.permissionService.checkStepEntitlement(context, step, session);
      this.sessionManager.recordEntitlementCheck(session, entitlement);
      if (!entitlement.allowed) {
        const message = entitlement.displayMessage ?? entitlement.reason ?? 'Feature locked';
        this.sessionManager.markStepFailed(session, step.stepId, message, 'PAYWALL_REQUIRED');
        state.lockedInfo = message;
        state.errorCode = 'PAYWALL_REQUIRED';
        state.renderPayload = {
          state: 'PAYWALL',
          display_message: message,
          reason_code: entitlement.reasonCode ?? 'ENTITLEMENT_REQUIRED',
          paywall_payload: entitlement.paywallPayload,
          feature_code: entitlement.feature,
          remaining_quota: entitlement.remainingQuota,
        };
        this.sessionManager.appendLog(session, {
          level: 'WARN',
          event: 'PAYWALL_RETURNED',
          message,
          stepId: step.stepId,
          action: step.action,
          errorCode: 'PAYWALL_REQUIRED',
        });
        break;
      }

      const invocation = this.sessionManager.markStepRunning(session, step);
      if (step.action === 'internal.summarize') {
        this.sessionManager.recordCapabilityResult(session, {
          invocationId: invocation.invocationId,
          stepId: step.stepId,
          action: step.action,
          ok: true,
          summary: 'Final summary generated',
        });
        this.sessionManager.markStepDone(session, step.stepId, 'Final summary generated');
        continue;
      }

      const result = await this.executeStep(step, context, session, state, uploadedClip);
      toolCalls.push({ capability: step.action, summary: result.summary, ok: result.ok });

      this.sessionManager.recordCapabilityResult(session, {
        invocationId: invocation.invocationId,
        stepId: step.stepId,
        action: step.action,
        ok: result.ok,
        summary: result.summary,
        error: result.error,
        errorCode: result.errorCode,
        retryable: result.retryable,
        data: result.data,
      });

      if (result.pending) {
        this.sessionManager.markStepDone(session, step.stepId, result.summary);
        state.renderPayload = {
          state: 'PENDING',
          display_message: result.summary,
          pending_task: {
            step_id: step.stepId,
            action: step.action,
            status: result.pending.status,
            poll_hint_seconds: result.pending.poll_hint_seconds,
          },
        };
        this.sessionManager.appendLog(session, {
          level: 'INFO',
          event: 'PENDING_RETURNED',
          message: result.summary,
          stepId: step.stepId,
          action: step.action,
          errorCode: 'TASK_PENDING',
        });
        break;
      }

      if (!result.ok) {
        this.sessionManager.markStepFailed(session, step.stepId, result.error ?? result.summary, result.errorCode);
        state.error = result.error ?? result.summary;
        state.errorCode = result.errorCode ?? 'CAPABILITY_FAILED';
        if (result.lockedInfo) state.lockedInfo = result.lockedInfo;

        if (result.paywall) {
          state.renderPayload = {
            state: 'PAYWALL',
            display_message: result.paywall.display_message,
            reason_code: result.paywall.reason_code,
            paywall_payload: result.paywall.paywall_payload,
            feature_code: result.paywall.feature_code,
            remaining_quota: result.paywall.remaining_quota,
          };
          this.sessionManager.appendLog(session, {
            level: 'WARN',
            event: 'PAYWALL_RETURNED',
            message: result.paywall.display_message,
            stepId: step.stepId,
            action: step.action,
            errorCode: 'PAYWALL_REQUIRED',
          });
        } else if (result.requiredInputs?.length) {
          state.renderPayload = {
            state: 'INPUT_REQUIRED',
            display_message: result.error ?? 'Missing required context',
            reason_code: result.errorCode ?? 'CONTEXT_INCOMPLETE',
            required_inputs: result.requiredInputs,
          };
          this.sessionManager.appendLog(session, {
            level: 'WARN',
            event: 'INPUT_REQUIRED_RETURNED',
            message: result.error ?? 'Missing required context',
            stepId: step.stepId,
            action: step.action,
            errorCode: result.errorCode ?? 'CONTEXT_INCOMPLETE',
          });
        } else if (result.retryable) {
          state.renderPayload = {
            state: 'RETRYABLE_ERROR',
            display_message: result.error ?? 'Temporary provider error',
            reason_code: result.errorCode ?? 'PROVIDER_RETRYABLE',
            retry_after_seconds: 20,
          };
          this.sessionManager.appendLog(session, {
            level: 'ERROR',
            event: 'RETRYABLE_ERROR_RETURNED',
            message: result.error ?? 'Temporary provider error',
            stepId: step.stepId,
            action: step.action,
            errorCode: result.errorCode ?? 'PROVIDER_RETRYABLE',
          });
        } else {
          state.renderPayload = {
            state: 'ERROR',
            display_message: result.error ?? 'Capability execution failed',
            reason_code: result.errorCode ?? 'CAPABILITY_FAILED',
          };
        }
        break;
      }

      if (step.requiresEntitlement) {
        const remaining = await this.consumeUsageOnSuccess(
          session.userId,
          step.requiresEntitlement,
          invocation.invocationId,
          context
        );
        this.sessionManager.updateQuota(session, step.requiresEntitlement, remaining);
      }

      this.sessionManager.markStepDone(session, step.stepId, result.summary);

      if (step.action === 'review.ask.match') {
        break;
      }
    }

    session.linkedAccount = state.linkedAccount;

    return {
      session,
      toolCalls,
      report: state.report,
      deepReview: state.deepReview,
      followupAnswer: state.followupAnswer,
      videoDiagnosis: state.videoDiagnosis,
      lockedInfo: state.lockedInfo,
      error: state.error,
      errorCode: state.errorCode,
      renderPayload: state.renderPayload ?? this.successRenderPayload(state),
    };
  }

  private async executeStep(
    step: PlanStep,
    context: CapabilityExecutionContext,
    session: AgentSession,
    state: ExecutorState,
    uploadedClip?: UploadedClipInput
  ): Promise<StepResult> {
    if (step.action === 'region.select') {
      const result = await this.registry.invoke({
        id: 'region.select',
        context,
        input: { region: session.region },
      });
      return this.asSummary(step.action, result);
    }

    if (step.action === 'account.link_status') {
      const result = await this.registry.invoke({
        id: 'account.link_status',
        context,
        input: {
          userId: session.userId,
          region: session.region,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { linked: boolean; account?: LinkedAccount };
        if (data.linked && data.account) state.linkedAccount = data.account;
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'account.link_mock') {
      if (state.linkedAccount) {
        return { ok: true, summary: 'Account already linked, skip mock link' };
      }
      const result = await this.registry.invoke({
        id: 'account.link_mock',
        context,
        input: {
          userId: session.userId,
          region: session.region,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { account: LinkedAccount };
        state.linkedAccount = data.account;
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'match.list_recent') {
      if (!state.linkedAccount) {
        return {
          ok: false,
          summary: 'Missing linked account',
          error: 'No linked account, cannot import matches',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['linked_account'],
        };
      }
      const result = await this.registry.invoke({
        id: 'match.list_recent',
        context,
        input: {
          userId: session.userId,
          region: session.region,
          accountId: state.linkedAccount.accountId,
          limit: 10,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { matches: MatchSummary[] };
        state.matches = data.matches;
        this.sessionManager.updateMatchContext(session, {
          recentMatches: data.matches.map((item) => ({
            matchId: item.matchId,
            championName: item.championName,
            outcome: item.outcome,
            playedAt: item.playedAt,
          })),
        });
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'match.select_target') {
      const result = await this.registry.invoke({
        id: 'match.select_target',
        context,
        input: {
          matches: state.matches,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { selectedMatchId: string };
        state.selectedMatchId = data.selectedMatchId;
        this.sessionManager.updateMatchContext(session, {
          selectedMatchId: data.selectedMatchId,
        });
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'entitlement.explain') {
      const result = await this.registry.invoke({
        id: 'entitlement.explain',
        context,
        input: {
          userId: session.userId,
          feature_code: 'DEEP_REVIEW',
        },
      });
      return this.asSummary(step.action, result);
    }

    if (step.action === 'review.generate_basic') {
      if (!state.linkedAccount || !state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing review input',
          error: 'Missing accountId or matchId for basic review',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['account_id', 'match_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'review.generate_basic',
        context,
        input: {
          userId: session.userId,
          region: session.region,
          accountId: state.linkedAccount.accountId,
          matchId: state.selectedMatchId,
          context: session.userGoal?.rawInput,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { report: BasicReviewReport };
        state.report = data.report;
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'review.deep.status') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for deep status',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'review.deep.status',
        context,
        input: {
          user_id: session.userId,
          match_id: state.selectedMatchId,
        },
      });
      return this.asSummary(step.action, result);
    }

    if (step.action === 'review.deep.generate') {
      if (!state.linkedAccount || !state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing deep review input',
          error: 'Missing accountId or matchId for deep review',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['account_id', 'match_id'],
        };
      }
      const generated = await this.registry.invoke({
        id: 'review.deep.generate',
        context,
        input: {
          user_id: session.userId,
          region: session.region,
          account_id: state.linkedAccount.accountId,
          match_id: state.selectedMatchId,
          authorization_context: {
            entitlement_checked: true,
          },
        },
      });
      if (!generated.result.ok) return this.asSummary(step.action, generated);

      const readBack = await this.registry.invoke({
        id: 'review.deep.get',
        context,
        input: {
          user_id: session.userId,
          match_id: state.selectedMatchId,
        },
      });
      if (readBack.result.ok) {
        const data = readBack.result.data as { result?: DeepReviewResult; status: string };
        if (data.status === 'COMPLETED' && data.result) state.deepReview = data.result;
      }
      return this.asSummary(step.action, generated);
    }

    if (step.action === 'review.deep.get') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for deep review get',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'review.deep.get',
        context,
        input: {
          user_id: session.userId,
          match_id: state.selectedMatchId,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { result?: DeepReviewResult; status: string };
        if (data.status === 'COMPLETED' && data.result) state.deepReview = data.result;
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'review.ask.match') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for follow-up question',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      const question = session.userGoal?.rawInput ?? 'Please summarize this match context.';
      const asked = await this.registry.invoke({
        id: 'review.ask.match',
        context,
        input: {
          user_id: session.userId,
          region: session.region,
          match_id: state.selectedMatchId,
          question,
          authorization_context: {
            entitlement_checked: true,
          },
        },
      });

      if (!asked.result.ok) return this.asSummary(step.action, asked);

      const data = asked.result.data as {
        status: 'ANSWERED' | 'NEEDS_DEEP_REVIEW' | 'PAYWALL_REQUIRED';
        answer?: MatchAskAnswer['answer'];
        paywall_action?: {
          feature_code: EntitlementFeature;
          reason_code: string;
          display_message: string;
          paywall_payload?: import('../../domain').PaywallPayload;
        };
      };

      if (data.status === 'PAYWALL_REQUIRED') {
        const message = data.paywall_action?.display_message ?? 'Follow-up is locked';
        return {
          ok: false,
          summary: message,
          error: message,
          errorCode: 'PAYWALL_REQUIRED',
          lockedInfo: message,
          paywall: {
            reason_code: data.paywall_action?.reason_code ?? 'ENTITLEMENT_REQUIRED',
            display_message: message,
            feature_code: data.paywall_action?.feature_code,
            paywall_payload: data.paywall_action?.paywall_payload,
          },
        };
      }

      if (data.status === 'NEEDS_DEEP_REVIEW') {
        if (!state.linkedAccount) {
          return {
            ok: false,
            summary: 'Need deep review first',
            error: 'Missing accountId for deep review generation',
            errorCode: 'CONTEXT_INCOMPLETE',
            requiredInputs: ['account_id'],
          };
        }
        const deep = await this.registry.invoke({
          id: 'review.deep.generate',
          context,
          input: {
            user_id: session.userId,
            region: session.region,
            account_id: state.linkedAccount.accountId,
            match_id: state.selectedMatchId,
            authorization_context: {
              entitlement_checked: true,
            },
          },
        });
        if (!deep.result.ok) return this.asSummary('review.deep.generate', deep);

        const retry = await this.registry.invoke({
          id: 'review.ask.match',
          context,
          input: {
            user_id: session.userId,
            region: session.region,
            match_id: state.selectedMatchId,
            question,
            authorization_context: {
              entitlement_checked: true,
            },
          },
        });
        if (!retry.result.ok) return this.asSummary(step.action, retry);
        const retryData = retry.result.data as {
          status: 'ANSWERED' | 'NEEDS_DEEP_REVIEW' | 'PAYWALL_REQUIRED';
          answer?: MatchAskAnswer['answer'];
        };
        if (retryData.status !== 'ANSWERED') {
          return {
            ok: false,
            summary: 'Unable to answer follow-up with current context',
            error: 'Unable to answer follow-up with current context',
            errorCode: 'CAPABILITY_FAILED',
          };
        }
        state.followupAnswer = retryData.answer;
        return {
          ok: true,
          summary: 'review.ask.match answered with deep review context',
          data: retry.result.data,
        };
      }

      state.followupAnswer = data.answer;
      return {
        ok: true,
        summary: 'review.ask.match answered with current match context',
        data: asked.result.data,
      };
    }

    if (step.action === 'review.ask.suggested_prompts') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for prompts',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'review.ask.suggested_prompts',
        context,
        input: {
          user_id: session.userId,
          match_id: state.selectedMatchId,
        },
      });
      return this.asSummary(step.action, result);
    }

    if (step.action === 'asset.video.upload') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for clip upload',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      if (!uploadedClip) {
        return {
          ok: false,
          summary: 'No clip uploaded',
          error: 'Clip review requires one uploaded short clip bound to current match',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['uploaded_clip'],
        };
      }
      const result = await this.registry.invoke({
        id: 'asset.video.upload',
        context,
        input: {
          user_id: session.userId,
          match_id: state.selectedMatchId,
          file_name: uploadedClip.file_name,
          mime_type: uploadedClip.mime_type,
          size_bytes: uploadedClip.size_bytes,
          duration_seconds: uploadedClip.duration_seconds,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as { asset_id: string; status: 'READY' };
        state.uploadedAssetId = data.asset_id;
        this.sessionManager.updateAssetContext(session, {
          clipAsset: {
            asset_id: data.asset_id,
            match_id: state.selectedMatchId,
            status: data.status,
            duration_seconds: uploadedClip.duration_seconds,
            size_bytes: uploadedClip.size_bytes,
          },
        });
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'diagnosis.video.create') {
      if (!state.selectedMatchId) {
        return {
          ok: false,
          summary: 'Missing match',
          error: 'Missing matchId for diagnosis create',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['match_id'],
        };
      }
      if (!state.uploadedAssetId) {
        return {
          ok: false,
          summary: 'Missing asset',
          error: 'Missing uploaded asset for diagnosis create',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['asset_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'diagnosis.video.create',
        context,
        input: {
          user_id: session.userId,
          region: session.region,
          match_id: state.selectedMatchId,
          asset_id: state.uploadedAssetId,
          natural_language_question: session.userGoal?.rawInput ?? 'Please diagnose this clip.',
          entitlement_context: {
            entitlement_checked: true,
          },
        },
      });
      if (result.result.ok) {
        const data = result.result.data as {
          task_id: string;
          status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        };
        state.diagnosisTaskId = data.task_id;
        this.sessionManager.updateAssetContext(session, {
          diagnosisTask: {
            task_id: data.task_id,
            status: data.status,
          },
        });
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'diagnosis.video.status') {
      const taskId = state.diagnosisTaskId;
      if (!taskId) {
        return {
          ok: false,
          summary: 'No diagnosis task id',
          error: 'diagnosis.video.create must run first',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['diagnosis_task_id'],
        };
      }
      const status = await this.resolveDiagnosisStatusWithPolling(taskId, context);

      if (!status.result.ok) return this.asSummary(step.action, status);

      const data = status.result.data as {
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        error_message?: string;
      };
      this.sessionManager.updateAssetContext(session, {
        diagnosisTask: {
          task_id: taskId,
          status: data.status,
          error_message: data.error_message,
        },
      });

      if (data.status === 'PENDING' || data.status === 'RUNNING') {
        return {
          ok: true,
          summary: `Diagnosis task is ${data.status.toLowerCase()}, polling is required`,
          pending: {
            status: data.status,
            poll_hint_seconds: 5,
          },
          data,
        };
      }

      if (data.status === 'FAILED') {
        return {
          ok: false,
          summary: data.error_message ?? 'Diagnosis task failed',
          error: data.error_message ?? 'Diagnosis task failed',
          errorCode: 'PROVIDER_RETRYABLE',
          retryable: true,
          data,
        };
      }

      return {
        ok: true,
        summary: 'diagnosis.video.status executed',
        data,
      };
    }

    if (step.action === 'diagnosis.video.get') {
      const taskId = state.diagnosisTaskId;
      if (!taskId) {
        return {
          ok: false,
          summary: 'No diagnosis task id',
          error: 'diagnosis.video.create must run first',
          errorCode: 'CONTEXT_INCOMPLETE',
          requiredInputs: ['diagnosis_task_id'],
        };
      }
      const result = await this.registry.invoke({
        id: 'diagnosis.video.get',
        context,
        input: {
          task_id: taskId,
        },
      });
      if (result.result.ok) {
        const data = result.result.data as {
          diagnosis_summary: string;
          structured_findings: VideoDiagnosisResult['structured_findings'];
          confidence_hints: VideoDiagnosisResult['confidence_hints'];
          recommended_next_questions: string[];
          render_payload: VideoDiagnosisResult['render_payload'];
          disclaimers: string[];
        };
        state.videoDiagnosis = {
          result_id: `result-from-${taskId}`,
          task_id: taskId,
          user_id: session.userId,
          match_id: state.selectedMatchId ?? '',
          asset_id: state.uploadedAssetId ?? '',
          status: 'COMPLETED',
          diagnosis_summary: data.diagnosis_summary,
          overall_judgement: data.render_payload.summary,
          likely_issue_types: [],
          key_moments: data.render_payload.key_moments,
          positional_or_trade_error: data.structured_findings[0]?.insight ?? 'See structured findings',
          execution_or_decision_hints: data.structured_findings.map((item) => item.advice),
          next_action_advice: data.recommended_next_questions,
          structured_findings: data.structured_findings,
          confidence_hints: data.confidence_hints,
          disclaimers: data.disclaimers,
          recommended_next_questions: data.recommended_next_questions,
          render_payload: data.render_payload,
          created_at: context.nowIso,
        };
      }
      return this.asSummary(step.action, result);
    }

    if (step.action === 'review.generate_deep') {
      return { ok: true, summary: 'Legacy deep review alias skipped' };
    }

    if (step.action === 'review.ask_followup') {
      return { ok: true, summary: 'Legacy follow-up alias skipped' };
    }

    if (step.action === 'review.analyze_clip') {
      return { ok: true, summary: 'Legacy clip alias skipped in favor of diagnosis.video.*' };
    }

    return {
      ok: false,
      summary: 'Unknown step action',
      error: `Unsupported action: ${step.action}`,
      errorCode: 'CAPABILITY_FAILED',
    };
  }

  private async consumeUsageOnSuccess(
    userId: string,
    featureCode: EntitlementFeature,
    invocationId: string,
    context: CapabilityExecutionContext
  ): Promise<number | undefined> {
    const result = await this.registry.invoke({
      id: 'usage.consume',
      context,
      input: {
        userId,
        feature_code: featureCode,
        usage_key: invocationId,
        operation_status: 'SUCCESS',
      },
    });

    if (!result.result.ok) return undefined;

    const data = result.result.data as {
      remaining_quota?: number;
    };
    return data.remaining_quota;
  }

  private successRenderPayload(state: ExecutorState): AgentRenderPayload {
    return {
      state: 'SUCCESS',
      display_message: 'Agent execution completed.',
      data: {
        report: state.report,
        deep_review: state.deepReview,
        followup_answer: state.followupAnswer,
        video_diagnosis: state.videoDiagnosis,
      },
    };
  }

  private asSummary(
    action: CapabilityId,
    response: {
      result: {
        ok: boolean;
        data?: unknown;
        error?: { message: string; code?: string; retryable?: boolean };
      };
    }
  ): StepResult {
    if (response.result.ok) {
      return {
        ok: true,
        summary: `${action} executed`,
        data: response.result.data,
      };
    }

    const reason = this.mapError(action, response.result.error?.code, response.result.error?.retryable);

    return {
      ok: false,
      summary: response.result.error?.message ?? 'Execution failed',
      error: response.result.error?.message ?? 'Execution failed',
      errorCode: reason,
      retryable: response.result.error?.retryable ?? false,
    };
  }

  private async resolveDiagnosisStatusWithPolling(
    taskId: string,
    context: CapabilityExecutionContext
  ): Promise<Awaited<ReturnType<CapabilityRegistry['invoke']>>> {
    let latest = await this.registry.invoke({
      id: 'diagnosis.video.status',
      context,
      input: {
        task_id: taskId,
      },
    });

    for (let i = 0; i < 6; i += 1) {
      if (!latest.result.ok) return latest;
      const status = (latest.result.data as { status?: string }).status;
      if (status === 'COMPLETED' || status === 'FAILED') return latest;

      await this.tryProcessLocalQueue();
      await this.sleep(20);
      latest = await this.registry.invoke({
        id: 'diagnosis.video.status',
        context,
        input: {
          task_id: taskId,
        },
      });
    }

    return latest;
  }

  private async tryProcessLocalQueue(): Promise<void> {
    await getLocalJobQueueRuntime().processDueJobs();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapError(
    action: CapabilityId,
    capabilityErrorCode?: string,
    retryable?: boolean
  ): AgentErrorCode {
    if (capabilityErrorCode === 'ENTITLEMENT_REQUIRED') return 'PAYWALL_REQUIRED';
    if (retryable) return 'PROVIDER_RETRYABLE';
    if (capabilityErrorCode === 'INVALID_INPUT' && (action === 'asset.video.upload' || action === 'diagnosis.video.create')) {
      return 'VIDEO_ASSET_INVALID';
    }
    if (capabilityErrorCode === 'INVALID_INPUT' || capabilityErrorCode === 'NOT_FOUND') return 'CONTEXT_INCOMPLETE';
    return 'CAPABILITY_FAILED';
  }
}

