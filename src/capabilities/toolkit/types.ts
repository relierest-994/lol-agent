import type { EntitlementFeature, Region } from '../../domain';

export type CapabilityId =
  | 'account.link_status'
  | 'account.link_mock'
  | 'region.select'
  | 'match.list_recent'
  | 'match.select_target'
  | 'asset.video.upload'
  | 'diagnosis.video.create'
  | 'diagnosis.video.status'
  | 'diagnosis.video.get'
  | 'review.generate_basic'
  | 'review.deep.generate'
  | 'review.deep.get'
  | 'review.deep.status'
  | 'entitlement.check'
  | 'entitlement.explain'
  | 'usage.consume'
  | 'review.generate_deep'
  | 'review.ask.followup'
  | 'review.ask.match'
  | 'review.ask.suggested_prompts'
  | 'review.ask_followup'
  | 'review.analyze_clip'
  | 'unlock.create'
  | 'unlock.confirm'
  | 'billing.unlock';

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface SchemaField {
  type: PrimitiveType;
  description: string;
  enum?: string[];
}

export interface CapabilitySchema {
  type: 'object';
  required: string[];
  properties: Record<string, SchemaField>;
}

export interface CapabilityErrorSchema {
  type: 'object';
  required: ['code', 'message'];
  properties: {
    code: SchemaField;
    message: SchemaField;
    details: SchemaField;
    retryable: SchemaField;
  };
}

export interface CapabilityError {
  code:
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'ENTITLEMENT_REQUIRED'
    | 'UNAUTHORIZED'
    | 'PROVIDER_ERROR'
    | 'CAPABILITY_NOT_REGISTERED'
    | 'INTERNAL_ERROR';
  message: string;
  details?: string;
  retryable?: boolean;
}

export type CapabilityResult<TOutput> =
  | { ok: true; data: TOutput }
  | { ok: false; error: CapabilityError };

export interface CapabilityExecutionContext {
  userId: string;
  nowIso: string;
  sessionId?: string;
  traceId?: string;
  correlationId?: string;
  region?: Region;
}

export interface EntitlementRequirement {
  required: boolean;
  feature?: EntitlementFeature;
  description: string;
}

export interface CapabilityMeta {
  id: CapabilityId;
  title: string;
  inputSchema: CapabilitySchema;
  outputSchema: CapabilitySchema;
  errorSchema: CapabilityErrorSchema;
  entitlement: EntitlementRequirement;
}

export interface CapabilityDefinition<TInput, TOutput> extends CapabilityMeta {
  invoke: (
    context: CapabilityExecutionContext,
    input: TInput,
    provider: CapabilityProvider
  ) => Promise<CapabilityResult<TOutput>>;
}

export interface CapabilityProvider {
  getLinkedAccount: (userId: string, region: Region) => Promise<import('../../domain').LinkedAccount | undefined>;
  linkMockAccount: (userId: string, region: Region) => Promise<import('../../domain').LinkedAccount>;
  listRecentMatches: (
    region: Region,
    accountId: string,
    limit: number
  ) => Promise<{ summaries: import('../../domain').MatchSummary[]; details: import('../../domain').MatchDetail[] }>;
  getMatchDetail: (region: Region, matchId: string) => Promise<import('../../domain').MatchDetail | undefined>;
  uploadVideoAsset: (input: {
    user_id: string;
    match_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
    nowIso: string;
  }) => Promise<
    | { ok: true; asset: import('../../domain').VideoClipAsset; warnings: string[] }
    | { ok: false; error: string }
  >;
  getVideoAsset: (assetId: string) => Promise<import('../../domain').VideoClipAsset | undefined>;
  createVideoDiagnosisTask: (input: {
    user_id: string;
    match_id: string;
    asset_id: string;
    natural_language_question: string;
    entitlement_context: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
    match: import('../../domain').MatchDetail;
    deepReview?: import('../../domain').DeepReviewResult;
    nowIso: string;
  }) => Promise<{ ok: true; task: import('../../domain').VideoDiagnosisTask } | { ok: false; error: string }>;
  runVideoDiagnosisTask: (taskId: string, input: {
    nowIso: string;
    match: import('../../domain').MatchDetail;
    deepReview?: import('../../domain').DeepReviewResult;
  }) => Promise<void>;
  getVideoDiagnosisTask: (taskId: string) => Promise<import('../../domain').VideoDiagnosisTask | undefined>;
  getLatestVideoDiagnosisTask: (
    userId: string,
    matchId: string
  ) => Promise<import('../../domain').VideoDiagnosisTask | undefined>;
  getVideoDiagnosisResultByTask: (taskId: string) => Promise<import('../../domain').VideoDiagnosisResult | undefined>;
  getLatestVideoDiagnosisResult: (
    userId: string,
    matchId: string
  ) => Promise<import('../../domain').VideoDiagnosisResult | undefined>;
  getEntitlement: (userId: string) => Promise<import('../../domain').EntitlementState>;
  checkFeatureAccess: (
    userId: string,
    featureCode: import('../../domain').EntitlementFeature,
    nowIso: string
  ) => Promise<import('../../domain').EntitlementDecision>;
  explainFeatureAccess: (
    userId: string,
    featureCode: import('../../domain').EntitlementFeature,
    nowIso: string
  ) => Promise<{
    userId: string;
    featureCode: import('../../domain').EntitlementFeature;
    decision: import('../../domain').EntitlementDecision;
    activeEntitlements: import('../../domain').UserEntitlement[];
    activeQuotas: import('../../domain').UsageQuota[];
    availablePlans: import('../../domain').SubscriptionPlan[];
  }>;
  consumeFeatureUsage: (input: {
    userId: string;
    featureCode: import('../../domain').EntitlementFeature;
    usageKey: string;
    operationStatus: 'SUCCESS' | 'FAILED';
    nowIso: string;
  }) => Promise<{
    consumed: boolean;
    reason_code: import('../../domain').ReasonCode;
    display_message: string;
    remaining_quota?: number;
  }>;
  createUnlockOrder: (input: {
    userId: string;
    planCode: string;
    featureCode?: import('../../domain').EntitlementFeature;
    nowIso: string;
  }) => Promise<
    | {
        ok: true;
        order: import('../../domain').PurchaseOrder;
        payment: import('../../domain').PaymentRecord;
        paywall_payload: import('../../domain').PaywallPayload;
      }
    | { ok: false; reason: string }
  >;
  confirmUnlockOrder: (input: {
    orderId: string;
    transactionId: string;
    nowIso: string;
  }) => Promise<
    | {
        ok: true;
        order: import('../../domain').PurchaseOrder;
        payment: import('../../domain').PaymentRecord;
        state: import('../../domain').EntitlementState;
      }
    | { ok: false; reason: string }
  >;
  getBillingSnapshot: (
    userId: string,
    nowIso: string
  ) => Promise<{
    plans: import('../../domain').SubscriptionPlan[];
    gates: import('../../domain').FeatureGate[];
    entitlements: import('../../domain').UserEntitlement[];
    quotas: import('../../domain').UsageQuota[];
    orders: import('../../domain').PurchaseOrder[];
    payments: import('../../domain').PaymentRecord[];
    unlocks: import('../../domain').UnlockRecord[];
  }>;
  getDeepReviewStatus: (input: {
    userId: string;
    matchId: string;
    nowIso: string;
  }) => Promise<{
    status: 'NOT_FOUND' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    task?: import('../../domain').DeepReviewTask;
    result?: import('../../domain').DeepReviewResult;
  }>;
  generateDeepReview: (input: {
    userId: string;
    region: Region;
    accountId: string;
    matchId: string;
    focusDimensions?: import('../../domain').DeepReviewDimension[];
    authorizationContext: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
    nowIso: string;
  }) => Promise<{
    task: import('../../domain').DeepReviewTask;
    result: import('../../domain').DeepReviewResult;
    fromCache: boolean;
  }>;
  getDeepReviewResult: (input: {
    userId: string;
    matchId: string;
    nowIso: string;
  }) => Promise<import('../../domain').DeepReviewResult | undefined>;
  askMatchQuestion: (input: {
    userId: string;
    region: Region;
    matchId: string;
    question: string;
    nowIso: string;
  }) => Promise<import('../../domain').MatchAskAnswer>;
  listSuggestedPrompts: (input: {
    userId: string;
    matchId: string;
    nowIso: string;
  }) => Promise<string[]>;
  generateBasicReview: (
    match: import('../../domain').MatchDetail,
    nowIso: string
  ) => Promise<import('../../domain').BasicReviewReport>;
}

export interface CapabilityInvocationRequest<TInput> {
  id: CapabilityId;
  context: CapabilityExecutionContext;
  input: TInput;
}

export interface CapabilityInvocationResponse<TOutput> {
  id: CapabilityId;
  meta: CapabilityMeta;
  result: CapabilityResult<TOutput>;
}


