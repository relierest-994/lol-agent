import type {
  BasicReviewReport,
  DeepReviewDimension,
  DeepReviewResult,
  EntitlementDecision,
  EntitlementFeature,
  EntitlementState,
  LinkedAccount,
  MatchAskAnswer,
  MatchDetail,
  MatchSummary,
  Region,
  VideoDiagnosisResult,
  VideoDiagnosisTask,
} from '../../../domain';
import {
  HttpClient,
} from '../../../infrastructure/clients';
import { validateProviderConfig } from '../../../infrastructure/config/provider-config.validator';
import { validateRuntimeEnvSchema } from '../../../infrastructure/config/env-schema';
import { loadRuntimeConfig } from '../../../infrastructure/config/runtime-config';
import { logger } from '../../../infrastructure/observability/logger';
import { mapProviderError } from '../../../infrastructure/providers/provider-error.mapper';
import { registerVideoDiagnosisQueueHandler } from '../../../workers/video-diagnosis.worker';
import { MockCapabilityProvider } from './mock-capability.provider';
import type { CapabilityProvider } from '../types';

export class RealCapabilityProvider implements CapabilityProvider {
  private readonly config = loadRuntimeConfig();
  private readonly fallback = new MockCapabilityProvider();

  private readonly appHttp = new HttpClient({
    baseUrl: this.config.apiBaseUrl,
    timeoutMs: this.config.requestTimeoutMs,
    retries: this.config.requestRetries,
  });

  constructor() {
    const schema = validateRuntimeEnvSchema(this.config);
    if (!schema.valid) {
      throw new Error(`Invalid environment schema: ${schema.errors.join('; ')}`);
    }
    const validation = validateProviderConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join('; ')}`);
    }
    if (validation.warnings.length) {
      logger.warn('Provider configuration warnings', {
        component: 'real-capability-provider',
        warnings: validation.warnings,
      });
    }
    registerVideoDiagnosisQueueHandler();
  }

  private createRequestId(scope: string): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `${scope}-${Date.now()}-${random}`;
  }

  private async withFallback<T>(
    scope: string,
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (!this.config.useBackendApi) {
      return fallback();
    }
    try {
      return await primary();
    } catch (error) {
      const normalized = mapProviderError(error);
      logger.warn('Real provider request failed', {
        component: 'real-capability-provider',
        scope,
        provider_error_code: normalized.code,
        retryable: normalized.retryable,
        error: normalized.details ?? normalized.message,
      });
      if (!this.config.allowMockFallback) throw error;
      logger.info('Falling back to mock provider', {
        component: 'real-capability-provider',
        scope,
      });
      return fallback();
    }
  }

  async getLinkedAccount(userId: string, region: Region): Promise<LinkedAccount | undefined> {
    return this.withFallback(
      'getLinkedAccount',
      () =>
        this.appHttp.request<LinkedAccount | undefined>({
          path: `accounts/linked?user_id=${encodeURIComponent(userId)}&region=${encodeURIComponent(region)}`,
          method: 'GET',
        }),
      () => this.fallback.getLinkedAccount(userId, region)
    );
  }

  async linkMockAccount(
    userId: string,
    region: Region,
    request?: { gameName?: string; tagLine?: string }
  ): Promise<LinkedAccount> {
    return this.withFallback(
      'linkMockAccount',
      () =>
        this.appHttp.request<LinkedAccount>({
          path: 'accounts/link',
          method: 'POST',
          body: {
            user_id: userId,
            region,
            game_name: request?.gameName,
            tag_line: request?.tagLine,
          },
        }),
      () => this.fallback.linkMockAccount(userId, region, request)
    );
  }

  async listRecentMatches(
    region: Region,
    accountId: string,
    limit: number
  ): Promise<{ summaries: MatchSummary[]; details: MatchDetail[] }> {
    return this.withFallback(
      'listRecentMatches',
      () =>
        this.appHttp.request<{ summaries: MatchSummary[]; details: MatchDetail[] }>({
          path: 'matches/recent',
          method: 'POST',
          body: { region, account_id: accountId, limit },
        }),
      () => this.fallback.listRecentMatches(region, accountId, limit)
    );
  }

  async getMatchDetail(region: Region, matchId: string): Promise<MatchDetail | undefined> {
    return this.withFallback(
      'getMatchDetail',
      () =>
        this.appHttp.request<MatchDetail | undefined>({
          path: `matches/${encodeURIComponent(matchId)}?region=${encodeURIComponent(region)}`,
          method: 'GET',
        }),
      () => this.fallback.getMatchDetail(region, matchId)
    );
  }

  async getMatchTimeline(region: Region, matchId: string): Promise<import('../../../domain').MatchTimeline | undefined> {
    return this.withFallback(
      'getMatchTimeline',
      () =>
        this.appHttp.request<import('../../../domain').MatchTimeline | undefined>({
          path: `matches/${encodeURIComponent(matchId)}/timeline?region=${encodeURIComponent(region)}`,
          method: 'GET',
        }),
      () => this.fallback.getMatchTimeline(region, matchId)
    );
  }

  async uploadVideoAsset(input: {
    user_id: string;
    match_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
    nowIso: string;
  }) {
    return this.withFallback(
      'uploadVideoAsset',
      () =>
        this.appHttp.request<{ ok: true; asset: import('../../../domain').VideoClipAsset; warnings: string[] }>({
          path: 'video/assets/upload',
          method: 'POST',
          body: input,
        }),
      () => this.fallback.uploadVideoAsset(input)
    );
  }

  async getVideoAsset(assetId: string) {
    return this.withFallback(
      'getVideoAsset',
      () =>
        this.appHttp.request<import('../../../domain').VideoClipAsset | undefined>({
          path: `video/assets/${encodeURIComponent(assetId)}`,
          method: 'GET',
        }),
      () => this.fallback.getVideoAsset(assetId)
    );
  }

  async createVideoDiagnosisTask(input: {
    user_id: string;
    match_id: string;
    asset_id: string;
    natural_language_question: string;
    entitlement_context: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
    match: MatchDetail;
    deepReview?: DeepReviewResult;
    nowIso: string;
  }) {
    return this.withFallback(
      'createVideoDiagnosisTask',
      () =>
        this.appHttp.request<{ ok: true; task: VideoDiagnosisTask } | { ok: false; error: string }>({
          path: 'video/tasks/create',
          method: 'POST',
          body: input,
        }),
      () => this.fallback.createVideoDiagnosisTask(input)
    );
  }

  async runVideoDiagnosisTask(taskId: string, input: { nowIso: string; match: MatchDetail; deepReview?: DeepReviewResult }) {
    return this.withFallback(
      'runVideoDiagnosisTask',
      () =>
        this.appHttp.request<void>({
          path: 'video/tasks/run',
          method: 'POST',
          body: { task_id: taskId, now_iso: input.nowIso, match: input.match, deep_review: input.deepReview },
        }),
      () => this.fallback.runVideoDiagnosisTask(taskId, input)
    );
  }

  async getVideoDiagnosisTask(taskId: string): Promise<VideoDiagnosisTask | undefined> {
    return this.withFallback(
      'getVideoDiagnosisTask',
      () =>
        this.appHttp.request<VideoDiagnosisTask | undefined>({
          path: `video/tasks/${encodeURIComponent(taskId)}`,
          method: 'GET',
        }),
      () => this.fallback.getVideoDiagnosisTask(taskId)
    );
  }

  async getLatestVideoDiagnosisTask(userId: string, matchId: string): Promise<VideoDiagnosisTask | undefined> {
    return this.withFallback(
      'getLatestVideoDiagnosisTask',
      () =>
        this.appHttp.request<VideoDiagnosisTask | undefined>({
          path: `video/tasks/latest?user_id=${encodeURIComponent(userId)}&match_id=${encodeURIComponent(matchId)}`,
          method: 'GET',
        }),
      () => this.fallback.getLatestVideoDiagnosisTask(userId, matchId)
    );
  }

  async getVideoDiagnosisResultByTask(taskId: string): Promise<VideoDiagnosisResult | undefined> {
    return this.withFallback(
      'getVideoDiagnosisResultByTask',
      () =>
        this.appHttp.request<VideoDiagnosisResult | undefined>({
          path: `video/results/by-task/${encodeURIComponent(taskId)}`,
          method: 'GET',
        }),
      () => this.fallback.getVideoDiagnosisResultByTask(taskId)
    );
  }

  async getLatestVideoDiagnosisResult(userId: string, matchId: string): Promise<VideoDiagnosisResult | undefined> {
    return this.withFallback(
      'getLatestVideoDiagnosisResult',
      () =>
        this.appHttp.request<VideoDiagnosisResult | undefined>({
          path: `video/results/latest?user_id=${encodeURIComponent(userId)}&match_id=${encodeURIComponent(matchId)}`,
          method: 'GET',
        }),
      () => this.fallback.getLatestVideoDiagnosisResult(userId, matchId)
    );
  }

  async getEntitlement(userId: string): Promise<EntitlementState> {
    return this.withFallback(
      'getEntitlement',
      () =>
        this.appHttp.request<EntitlementState>({
          path: `entitlements/state?user_id=${encodeURIComponent(userId)}`,
          method: 'GET',
        }),
      () => this.fallback.getEntitlement(userId)
    );
  }

  async checkFeatureAccess(userId: string, featureCode: EntitlementFeature, nowIso: string): Promise<EntitlementDecision> {
    return this.withFallback(
      'checkFeatureAccess',
      () =>
        this.appHttp.request<EntitlementDecision>({
          path: 'entitlements/check',
          method: 'POST',
          body: { user_id: userId, feature_code: featureCode, now_iso: nowIso },
        }),
      () => this.fallback.checkFeatureAccess(userId, featureCode, nowIso)
    );
  }

  async explainFeatureAccess(userId: string, featureCode: EntitlementFeature, nowIso: string) {
    return this.withFallback(
      'explainFeatureAccess',
      () =>
        this.appHttp.request<{
          userId: string;
          featureCode: EntitlementFeature;
          decision: EntitlementDecision;
          activeEntitlements: import('../../../domain').UserEntitlement[];
          activeQuotas: import('../../../domain').UsageQuota[];
          availablePlans: import('../../../domain').SubscriptionPlan[];
        }>({
          path: 'entitlements/explain',
          method: 'POST',
          body: { user_id: userId, feature_code: featureCode, now_iso: nowIso },
        }),
      () => this.fallback.explainFeatureAccess(userId, featureCode, nowIso)
    );
  }

  async consumeFeatureUsage(input: {
    userId: string;
    featureCode: EntitlementFeature;
    usageKey: string;
    operationStatus: 'SUCCESS' | 'FAILED';
    nowIso: string;
  }) {
    return this.withFallback(
      'consumeFeatureUsage',
      () =>
        this.appHttp.request<{
          consumed: boolean;
          reason_code: import('../../../domain').ReasonCode;
          display_message: string;
          remaining_quota?: number;
        }>({
          path: 'entitlements/consume',
          method: 'POST',
          body: {
            user_id: input.userId,
            feature_code: input.featureCode,
            usage_key: input.usageKey,
            operation_status: input.operationStatus,
            now_iso: input.nowIso,
          },
        }),
      () => this.fallback.consumeFeatureUsage(input)
    );
  }

  async createUnlockOrder(input: { userId: string; planCode: string; featureCode?: EntitlementFeature; nowIso: string }) {
    return this.withFallback(
      'createUnlockOrder',
      () =>
        this.appHttp.request<
          | {
              ok: true;
              order: import('../../../domain').PurchaseOrder;
              payment: import('../../../domain').PaymentRecord;
              paywall_payload: import('../../../domain').PaywallPayload;
            }
          | { ok: false; reason: string }
        >({
          path: 'payments/order/create',
          method: 'POST',
          body: { user_id: input.userId, plan_code: input.planCode, feature_code: input.featureCode, now_iso: input.nowIso },
        }),
      () => this.fallback.createUnlockOrder(input)
    );
  }

  async confirmUnlockOrder(input: { orderId: string; transactionId: string; nowIso: string }) {
    return this.withFallback(
      'confirmUnlockOrder',
      () =>
        this.appHttp.request<
          | {
              ok: true;
              order: import('../../../domain').PurchaseOrder;
              payment: import('../../../domain').PaymentRecord;
              state: import('../../../domain').EntitlementState;
            }
          | { ok: false; reason: string }
        >({
          path: 'payments/order/confirm',
          method: 'POST',
          body: { order_id: input.orderId, transaction_id: input.transactionId, now_iso: input.nowIso },
        }),
      () => this.fallback.confirmUnlockOrder(input)
    );
  }

  async getBillingSnapshot(userId: string, nowIso: string) {
    return this.withFallback(
      'getBillingSnapshot',
      () =>
        this.appHttp.request<{
          plans: import('../../../domain').SubscriptionPlan[];
          gates: import('../../../domain').FeatureGate[];
          entitlements: import('../../../domain').UserEntitlement[];
          quotas: import('../../../domain').UsageQuota[];
          orders: import('../../../domain').PurchaseOrder[];
          payments: import('../../../domain').PaymentRecord[];
          unlocks: import('../../../domain').UnlockRecord[];
        }>({
          path: 'payments/snapshot',
          method: 'POST',
          body: { user_id: userId, now_iso: nowIso },
        }),
      () => this.fallback.getBillingSnapshot(userId, nowIso)
    );
  }

  async getDeepReviewStatus(input: { userId: string; matchId: string; nowIso: string }) {
    return this.withFallback(
      'getDeepReviewStatus',
      () =>
        this.appHttp.request<{
          status: 'NOT_FOUND' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
          task?: import('../../../domain').DeepReviewTask;
          result?: import('../../../domain').DeepReviewResult;
        }>({
          path: 'reviews/deep/status',
          method: 'POST',
          body: { user_id: input.userId, match_id: input.matchId, now_iso: input.nowIso },
        }),
      () => this.fallback.getDeepReviewStatus(input)
    );
  }

  async generateDeepReview(input: {
    userId: string;
    region: Region;
    accountId: string;
    matchId: string;
    focusDimensions?: DeepReviewDimension[];
    authorizationContext: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
    nowIso: string;
  }): Promise<{ task: import('../../../domain').DeepReviewTask; result: DeepReviewResult; fromCache: boolean }> {
    return this.withFallback(
      'generateDeepReview',
      () =>
        this.appHttp.request<{ task: import('../../../domain').DeepReviewTask; result: DeepReviewResult; fromCache: boolean }>({
          path: 'reviews/deep/generate',
          method: 'POST',
          body: {
            user_id: input.userId,
            region: input.region,
            account_id: input.accountId,
            match_id: input.matchId,
            focus_dimensions: input.focusDimensions,
            authorization_context: input.authorizationContext,
            now_iso: input.nowIso,
            request_id: this.createRequestId('deep-review'),
          },
        }),
      () => this.fallback.generateDeepReview(input)
    );
  }

  async getDeepReviewResult(input: { userId: string; matchId: string; nowIso: string }): Promise<DeepReviewResult | undefined> {
    return this.withFallback(
      'getDeepReviewResult',
      () =>
        this.appHttp.request<DeepReviewResult | undefined>({
          path: 'reviews/deep/result',
          method: 'POST',
          body: { user_id: input.userId, match_id: input.matchId, now_iso: input.nowIso },
        }),
      () => this.fallback.getDeepReviewResult(input)
    );
  }

  async askMatchQuestion(input: { userId: string; region: Region; matchId: string; question: string; nowIso: string }): Promise<MatchAskAnswer> {
    return this.withFallback(
      'askMatchQuestion',
      () =>
        this.appHttp.request<MatchAskAnswer>({
          path: 'reviews/ask/match',
          method: 'POST',
          body: {
            user_id: input.userId,
            region: input.region,
            match_id: input.matchId,
            question: input.question,
            now_iso: input.nowIso,
            request_id: this.createRequestId('followup'),
          },
        }),
      () => this.fallback.askMatchQuestion(input)
    );
  }

  async listSuggestedPrompts(input: { userId: string; matchId: string; nowIso: string }): Promise<string[]> {
    return this.withFallback(
      'listSuggestedPrompts',
      () =>
        this.appHttp.request<string[]>({
          path: 'reviews/ask/suggested-prompts',
          method: 'POST',
          body: { user_id: input.userId, match_id: input.matchId, now_iso: input.nowIso },
        }),
      () => this.fallback.listSuggestedPrompts(input)
    );
  }

  async generateBasicReview(match: MatchDetail, nowIso: string): Promise<BasicReviewReport> {
    return this.withFallback(
      'generateBasicReview',
      async () =>
        this.appHttp.request<BasicReviewReport>({
          path: 'reviews/basic/generate',
          method: 'POST',
          body: {
            match,
            now_iso: nowIso,
          },
        }),
      () => this.fallback.generateBasicReview(match, nowIso)
    );
  }

  async runVideoDiagnosisFromQueueJob(input: {
    task_id: string;
    user_id: string;
    match_id: string;
    asset_id: string;
    asset_url?: string;
    question: string;
    now_iso: string;
  }): Promise<void> {
    await this.appHttp.request({
      path: 'video/tasks/run-from-queue',
      method: 'POST',
      body: {
        ...input,
        video_model: this.config.videoLlmModel,
        request_id: this.createRequestId('video-diagnosis'),
      },
    });
  }
}

export function createRealCapabilityProvider(): CapabilityProvider {
  return new RealCapabilityProvider();
}
