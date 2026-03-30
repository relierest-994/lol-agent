import type { CapabilityId } from '../../capabilities/toolkit';
import type {
  AgentStepRecord,
  BasicReviewReport,
  DeepReviewResult,
  EntitlementFeature,
  LinkedAccount,
  MatchAskAnswer,
  MatchSummary,
  Region,
  VideoClipAsset,
  VideoDiagnosisResult,
} from '../../domain';

export type UserGoalIntent =
  | 'BASIC_REVIEW'
  | 'DEEP_REVIEW'
  | 'CLIP_REVIEW'
  | 'AI_FOLLOWUP'
  | 'ENTITLEMENT_VIEW'
  | 'UNKNOWN';

export interface UserGoal {
  rawInput: string;
  intent: UserGoalIntent;
  target: 'LATEST_MATCH';
}

export type PlanAction = CapabilityId | 'internal.summarize';

export interface PlanStep {
  stepId: string;
  title: string;
  action: PlanAction;
  requiresEntitlement?: EntitlementFeature;
}

export interface AgentPlan {
  planId: string;
  summary: string;
  goal: UserGoal;
  steps: PlanStep[];
  createdAt: string;
}

export interface CapabilityInvocation {
  invocationId: string;
  stepId: string;
  action: PlanAction;
  inputSummary: string;
  startedAt: string;
  endedAt?: string;
  status: 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
}

export interface CapabilityResult {
  invocationId: string;
  stepId: string;
  action: PlanAction;
  ok: boolean;
  summary: string;
  error?: string;
  errorCode?: AgentErrorCode;
  retryable?: boolean;
  data?: unknown;
}

export interface EntitlementCheckResult {
  stepId: string;
  allowed: boolean;
  feature?: EntitlementFeature;
  reason?: string;
  reasonCode?: string;
  displayMessage?: string;
  remainingQuota?: number;
  paywallPayload?: import('../../domain').PaywallPayload;
}

export interface AgentMatchContext {
  target: 'LATEST_MATCH';
  selectedMatchId?: string;
  recentMatches?: Array<Pick<MatchSummary, 'matchId' | 'championName' | 'outcome' | 'playedAt'>>;
}

export interface AgentEntitlementContext {
  checkedFeatures: EntitlementFeature[];
  featureAvailability: Partial<Record<EntitlementFeature, boolean>>;
  remainingQuota: Partial<Record<EntitlementFeature, number>>;
  paywallFeature?: EntitlementFeature;
}

export interface AgentAssetContext {
  uploadedClip?: {
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
  };
  clipAsset?: Pick<VideoClipAsset, 'asset_id' | 'match_id' | 'status' | 'duration_seconds' | 'size_bytes'>;
  diagnosisTask?: {
    task_id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    error_message?: string;
  };
}

export type AgentErrorCode =
  | 'PAYWALL_REQUIRED'
  | 'TASK_PENDING'
  | 'PROVIDER_RETRYABLE'
  | 'CONTEXT_INCOMPLETE'
  | 'VIDEO_ASSET_INVALID'
  | 'CAPABILITY_FAILED'
  | 'UNKNOWN_INTENT';

export interface AgentRuntimeLog {
  at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  event:
    | 'SESSION_CREATED'
    | 'GOAL_BOUND'
    | 'PLAN_BOUND'
    | 'STEP_RUNNING'
    | 'STEP_DONE'
    | 'STEP_FAILED'
    | 'CAPABILITY_CALLED'
    | 'CAPABILITY_DONE'
    | 'ENTITLEMENT_CHECKED'
    | 'PAYWALL_RETURNED'
    | 'PENDING_RETURNED'
    | 'RETRYABLE_ERROR_RETURNED'
    | 'INPUT_REQUIRED_RETURNED'
    | 'SUMMARY_SYNTHESIZED';
  message: string;
  traceId: string;
  correlationId: string;
  stepId?: string;
  action?: PlanAction;
  errorCode?: AgentErrorCode;
  details?: Record<string, unknown>;
}

export type AgentRenderPayload =
  | {
      state: 'SUCCESS';
      display_message: string;
      data: {
        report?: BasicReviewReport;
        deep_review?: DeepReviewResult;
        followup_answer?: MatchAskAnswer['answer'];
        video_diagnosis?: VideoDiagnosisResult;
      };
    }
  | {
      state: 'PAYWALL';
      display_message: string;
      reason_code: string;
      paywall_payload?: import('../../domain').PaywallPayload;
      feature_code?: EntitlementFeature;
      remaining_quota?: number;
    }
  | {
      state: 'PENDING';
      display_message: string;
      pending_task: {
        step_id: string;
        action: PlanAction;
        status: 'PENDING' | 'RUNNING';
        poll_hint_seconds: number;
      };
    }
  | {
      state: 'RETRYABLE_ERROR';
      display_message: string;
      reason_code: AgentErrorCode;
      retry_after_seconds?: number;
    }
  | {
      state: 'INPUT_REQUIRED';
      display_message: string;
      reason_code: AgentErrorCode;
      required_inputs: string[];
    }
  | {
      state: 'ERROR';
      display_message: string;
      reason_code: AgentErrorCode;
    };

export interface AgentSession {
  sessionId: string;
  traceId: string;
  correlationId: string;
  userId: string;
  region: Region;
  createdAt: string;
  updatedAt: string;
  userGoal?: UserGoal;
  plan?: AgentPlan;
  linkedAccount?: LinkedAccount;
  stepStates: AgentStepRecord[];
  invocations: CapabilityInvocation[];
  capabilityResults: CapabilityResult[];
  entitlementChecks: EntitlementCheckResult[];
  matchContext: AgentMatchContext;
  entitlementContext: AgentEntitlementContext;
  assetContext: AgentAssetContext;
  runtimeLogs: AgentRuntimeLog[];
}

export interface AgentFinalResponse {
  session: AgentSession;
  plan: AgentPlan;
  report?: BasicReviewReport;
  deepReview?: DeepReviewResult;
  followupAnswer?: MatchAskAnswer['answer'];
  videoDiagnosis?: VideoDiagnosisResult;
  lockedInfo?: string;
  error?: string;
  errorCode?: AgentErrorCode;
  renderPayload: AgentRenderPayload;
  summary: string;
}

