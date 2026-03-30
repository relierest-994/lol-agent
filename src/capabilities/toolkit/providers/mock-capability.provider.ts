import { entitlementBillingService } from '../../../application/services/entitlement-billing.service';
import { videoDiagnosisService } from '../../../application/services/video-diagnosis.service';
import { MatchImportUseCase } from '../../../application/use-cases/match-import/match-import.use-case';
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
import { createMockProviderRegistries } from '../../../infrastructure/providers';
import { BasicReviewEngine } from '../../../infrastructure/providers/basic-review.engine';
import { DeepReviewEngine } from '../../../infrastructure/providers/deep-review.engine';
import { getLocalJobQueueRuntime } from '../../../infrastructure/queue/job-queue.runtime';
import { MockDeepReviewRepository } from '../../../infrastructure/repositories/mock-deep-review.repository';
import type { CapabilityProvider } from '../types';

const sharedDeepReviewRepository = new MockDeepReviewRepository();

function deepKeywords(question: string): boolean {
  return /对线|中期|节奏|资源|团战|出装|符文|技能|位置|细节|拆解|为什么/.test(question);
}

function summarizeBasic(report: BasicReviewReport): string {
  const overall = report.sections[0]?.lines[0] ?? '本局存在可优化空间';
  const issue = report.sections[2]?.lines[0] ?? '中期决策需要优化';
  const advice = report.sections[4]?.lines[0] ?? '建议先稳住节奏';
  return `${overall}。核心问题：${issue}。建议：${advice}`;
}

export class MockCapabilityProvider implements CapabilityProvider {
  private readonly reviewEngine = new BasicReviewEngine();
  private readonly deepReviewEngine = new DeepReviewEngine();
  private readonly registries = createMockProviderRegistries();
  private readonly matchUseCase = new MatchImportUseCase(this.registries.matchRegistry);

  constructor() {
    const queue = getLocalJobQueueRuntime();
    queue.registerHandler('video_diagnosis', async (payload) => {
      const typed = payload as {
        task_id: string;
        now_iso: string;
        match: MatchDetail;
        deep_review?: DeepReviewResult;
      };
      await videoDiagnosisService.runDiagnosis(typed.task_id, {
        nowIso: typed.now_iso,
        match: typed.match,
        deepReview: typed.deep_review,
      });
    });
    queue.registerHandler('deep_review_generate', async (payload) => {
      const typed = payload as {
        task_id: string;
        user_id: string;
        region: Region;
        account_id: string;
        match_id: string;
        focus_dimensions?: DeepReviewDimension[];
        authorization_context: {
          entitlement_checked: boolean;
          reason_code?: string;
        };
        now_iso: string;
      };
      await this.executeDeepReviewJob({
        taskId: typed.task_id,
        userId: typed.user_id,
        region: typed.region,
        matchId: typed.match_id,
        focusDimensions: typed.focus_dimensions,
        nowIso: typed.now_iso,
      });
    });
  }

  async getLinkedAccount(userId: string, region: Region): Promise<LinkedAccount | undefined> {
    const provider = this.registries.accountRegistry.get(region);
    const status = await provider.getLinkStatus(userId);
    return status.account;
  }

  async linkMockAccount(userId: string, region: Region): Promise<LinkedAccount> {
    const provider = this.registries.accountRegistry.get(region);
    return provider.linkAccountMock(userId);
  }

  async listRecentMatches(
    region: Region,
    accountId: string,
    limit: number
  ): Promise<{ summaries: MatchSummary[]; details: MatchDetail[] }> {
    const list = await this.matchUseCase.listRecent({ region, accountId, limit });
    const details = await Promise.all(
      list.matches.map(async (item) => {
        const bundle = await this.matchUseCase.getMatchBundle(region, item.matchId);
        return bundle.detail;
      })
    );
    return { summaries: list.matches, details };
  }

  async getMatchDetail(region: Region, matchId: string): Promise<MatchDetail | undefined> {
    try {
      const bundle = await this.matchUseCase.getMatchBundle(region, matchId);
      return bundle.detail;
    } catch {
      return undefined;
    }
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
    return videoDiagnosisService.uploadVideoClip(input);
  }

  async getVideoAsset(assetId: string) {
    return videoDiagnosisService.getAsset(assetId);
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
    const created = await videoDiagnosisService.createDiagnosis({
      ...input,
      basic_review_summary: undefined,
    });
    if (created.ok) {
      await getLocalJobQueueRuntime().enqueue({
        queue_name: 'video_diagnosis',
        job_type: 'video_diagnosis',
        payload: {
          task_id: created.task.task_id,
          now_iso: input.nowIso,
          match: input.match,
          deep_review: input.deepReview,
        },
      });
    }
    return created;
  }

  async runVideoDiagnosisTask(taskId: string, input: {
    nowIso: string;
    match: MatchDetail;
    deepReview?: DeepReviewResult;
  }) {
    return videoDiagnosisService.runDiagnosis(taskId, input);
  }

  async getVideoDiagnosisTask(taskId: string): Promise<VideoDiagnosisTask | undefined> {
    return videoDiagnosisService.getDiagnosisTask(taskId);
  }

  async getLatestVideoDiagnosisTask(userId: string, matchId: string): Promise<VideoDiagnosisTask | undefined> {
    return videoDiagnosisService.getLatestDiagnosisTask(userId, matchId);
  }

  async getVideoDiagnosisResultByTask(taskId: string): Promise<VideoDiagnosisResult | undefined> {
    return videoDiagnosisService.getDiagnosisResultByTask(taskId);
  }

  async getLatestVideoDiagnosisResult(userId: string, matchId: string): Promise<VideoDiagnosisResult | undefined> {
    return videoDiagnosisService.getLatestDiagnosisResult(userId, matchId);
  }

  async getEntitlement(userId: string): Promise<EntitlementState> {
    return entitlementBillingService.getEntitlementState(userId, new Date().toISOString());
  }

  async checkFeatureAccess(userId: string, featureCode: EntitlementFeature, nowIso: string): Promise<EntitlementDecision> {
    return entitlementBillingService.check({ userId, featureCode, nowIso });
  }

  async explainFeatureAccess(userId: string, featureCode: EntitlementFeature, nowIso: string) {
    return entitlementBillingService.explain({ userId, featureCode, nowIso });
  }

  async consumeFeatureUsage(input: {
    userId: string;
    featureCode: EntitlementFeature;
    usageKey: string;
    operationStatus: 'SUCCESS' | 'FAILED';
    nowIso: string;
  }) {
    return entitlementBillingService.consume(input);
  }

  async createUnlockOrder(input: { userId: string; planCode: string; featureCode?: EntitlementFeature; nowIso: string }) {
    return entitlementBillingService.createUnlockOrder(input);
  }

  async confirmUnlockOrder(input: { orderId: string; transactionId: string; nowIso: string }) {
    return entitlementBillingService.confirmUnlock(input);
  }

  async getBillingSnapshot(userId: string, nowIso: string) {
    return entitlementBillingService.getSnapshot(userId, nowIso);
  }

  async getDeepReviewStatus(input: { userId: string; matchId: string; nowIso: string }) {
    const result = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    if (result) {
      return {
        status: 'COMPLETED' as const,
        result,
      };
    }
    const task = sharedDeepReviewRepository.getLatestTask(input.userId, input.matchId);
    if (!task) return { status: 'NOT_FOUND' as const };
    return {
      status: task.status,
      task,
    };
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
  }): Promise<{
    task: import('../../../domain').DeepReviewTask;
    result: DeepReviewResult;
    fromCache: boolean;
  }> {
    const cached = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    if (cached) {
      return {
        task:
          sharedDeepReviewRepository.getLatestTask(input.userId, input.matchId) ??
          sharedDeepReviewRepository.createTask(
            {
              user_id: input.userId,
              match_id: input.matchId,
              status: 'COMPLETED',
              focus_dimensions: input.focusDimensions ?? cached.dimensions,
              authorization_context: input.authorizationContext,
            },
            input.nowIso
          ),
        result: { ...cached, cached: true },
        fromCache: true,
      };
    }

    const task = sharedDeepReviewRepository.createTask(
      {
        user_id: input.userId,
        match_id: input.matchId,
        status: 'PENDING',
        focus_dimensions:
          input.focusDimensions ?? ['LANING', 'MIDGAME_TEMPO', 'RESOURCE_CONTROL', 'TEAMFIGHT', 'BUILD_SKILL_PATH', 'ROLE_SPECIFIC'],
        authorization_context: input.authorizationContext,
      },
      input.nowIso
    );
    await getLocalJobQueueRuntime().enqueue({
      queue_name: 'deep_review',
      job_type: 'deep_review_generate',
      payload: {
        task_id: task.task_id,
        user_id: input.userId,
        region: input.region,
        account_id: input.accountId,
        match_id: input.matchId,
        focus_dimensions: input.focusDimensions,
        authorization_context: input.authorizationContext,
        now_iso: input.nowIso,
      },
    });

    for (let i = 0; i < 40; i += 1) {
      const result = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
      if (result && result.task_id === task.task_id) {
        return {
          task,
          result,
          fromCache: false,
        };
      }
      const taskState = sharedDeepReviewRepository.getLatestTask(input.userId, input.matchId);
      if (taskState?.status === 'FAILED') {
        throw new Error(taskState.error_message ?? 'Deep review task failed');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error('Deep review task timeout');
  }

  async getDeepReviewResult(input: { userId: string; matchId: string; nowIso: string }): Promise<DeepReviewResult | undefined> {
    const result = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    if (!result) return undefined;
    return {
      ...result,
      cached: true,
    };
  }

  async askMatchQuestion(input: {
    userId: string;
    region: Region;
    matchId: string;
    question: string;
    nowIso: string;
  }): Promise<MatchAskAnswer> {
    const conversation = sharedDeepReviewRepository.getOrCreateConversation(input.userId, input.matchId, input.nowIso);
    sharedDeepReviewRepository.getOrCreateContext(input.userId, input.matchId, input.region, input.nowIso);

    sharedDeepReviewRepository.addConversationMessage({
      conversation_id: conversation.conversation_id,
      user_id: input.userId,
      match_id: input.matchId,
      role: 'USER',
      content: input.question,
      references: [],
      created_at: input.nowIso,
    });

    const match = await this.getMatchDetail(input.region, input.matchId);
    if (!match) {
      return {
        status: 'PAYWALL_REQUIRED',
        cited_from: { basic_review: false, deep_review: false },
        paywall_action: {
          feature_code: 'AI_FOLLOWUP',
          reason_code: 'MATCH_NOT_FOUND',
          display_message: 'Current match context is missing, cannot answer follow-up',
        },
        suggested_prompts: [],
      };
    }

    const basic = await this.generateBasicReview(match, input.nowIso);
    sharedDeepReviewRepository.markBasicReviewGenerated(input.userId, input.matchId, input.region, input.nowIso);

    const deep = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    const needsDeep = deepKeywords(input.question);
    if (needsDeep && !deep) {
      return {
        status: 'NEEDS_DEEP_REVIEW',
        cited_from: { basic_review: true, deep_review: false },
        suggested_prompts: [
          'Run deep review first, then tell me the highest-priority fix.',
          'Which mid-game exchange was the worst by timeline?',
          'Give me three actionable changes for vision and positioning.',
        ],
      };
    }

    const answerSummary = deep
      ? `Based on deep review: ${deep.render_payload.sections[0]?.insight ?? 'Key issue is mid-game tempo and resource conversion.'}`
      : summarizeBasic(basic);

    const sections = deep
      ? deep.render_payload.sections.slice(0, 2).map((section) => ({
          section_title: section.section_title,
          insight: section.insight,
          evidence: section.evidence,
          advice: section.advice,
          tags: section.tags,
          severity: section.severity,
        }))
      : [
          {
            section_title: 'Match Follow-up',
            insight: answerSummary,
            evidence: [basic.sections[1]?.lines[0] ?? 'Basic review key factor available'],
            advice: basic.sections[4]?.lines[0] ?? 'Stabilize tempo and verify vision before re-engage',
            tags: ['basic-review', 'match-context'],
            severity: 'MEDIUM' as const,
          },
        ];

    const response: MatchAskAnswer = {
      status: 'ANSWERED',
      answer: {
        summary: answerSummary,
        sections,
      },
      cited_from: {
        basic_review: true,
        deep_review: Boolean(deep),
      },
      suggested_prompts: deep
        ? [
            'If I can change one habit, which one gives highest impact?',
            'Give me action checklist for minute 10/15/20.',
            'Provide a safer variant against the same matchup.',
          ]
        : [
            'If we need finer mid-game rotation analysis, trigger deep review.',
            'Which exact timestamp had the costliest decision?',
            'What should I prioritize in first 3 minutes next game?',
          ],
    };

    sharedDeepReviewRepository.addConversationMessage({
      conversation_id: conversation.conversation_id,
      user_id: input.userId,
      match_id: input.matchId,
      role: 'AGENT',
      content: response.answer?.summary ?? 'Answered',
      references: deep ? ['BASIC_REVIEW', 'DEEP_REVIEW'] : ['BASIC_REVIEW'],
      created_at: input.nowIso,
    });

    return response;
  }

  async listSuggestedPrompts(input: { userId: string; matchId: string; nowIso: string }): Promise<string[]> {
    const deep = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    if (deep) {
      return [
        'Which teamfight timestamp has the worst positioning?',
        'When should I pivot build defensively in this game?',
        'How do I convert lane lead into objective control?',
      ];
    }
    return [
      'What are my top three issues this game?',
      'Why did my mid-game collapse?',
      'Give me a deep-review-focused question template.',
    ];
  }

  async generateBasicReview(match: MatchDetail, nowIso: string) {
    return this.reviewEngine.generate(match, nowIso);
  }

  private async executeDeepReviewJob(input: {
    taskId: string;
    userId: string;
    region: Region;
    matchId: string;
    focusDimensions?: DeepReviewDimension[];
    nowIso: string;
  }): Promise<void> {
    sharedDeepReviewRepository.updateTaskStatus(input.taskId, 'RUNNING', input.nowIso);
    const match = await this.getMatchDetail(input.region, input.matchId);
    if (!match) {
      sharedDeepReviewRepository.updateTaskStatus(input.taskId, 'FAILED', input.nowIso, 'match not found');
      return;
    }

    const basicReview = await this.generateBasicReview(match, input.nowIso);
    sharedDeepReviewRepository.markBasicReviewGenerated(input.userId, input.matchId, input.region, input.nowIso);

    const generated = this.deepReviewEngine.generate({
      userId: input.userId,
      matchId: input.matchId,
      taskId: input.taskId,
      match,
      basicReview,
      focusDimensions: input.focusDimensions,
      nowIso: input.nowIso,
    });
    sharedDeepReviewRepository.saveResult({
      ...generated,
      cached: false,
    });
    sharedDeepReviewRepository.updateTaskStatus(input.taskId, 'COMPLETED', input.nowIso);
    sharedDeepReviewRepository.markDeepReviewGenerated(input.userId, input.matchId, input.region, input.nowIso);
  }
}
