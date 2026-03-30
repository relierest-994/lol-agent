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

function summarizeBasic(report: BasicReviewReport): string {
  const overall = report.sections[0]?.lines[0] ?? '本局存在可优化空间';
  const issue = report.sections[2]?.lines[0] ?? '中期决策需要优化';
  const advice = report.sections[4]?.lines[0] ?? '建议先稳住节奏';
  return `${overall}。核心问题：${issue}。建议：${advice}`;
}

function inferFocus(question: string): 'EARLY' | 'MID' | 'TEAMFIGHT' | 'OBJECTIVE' | 'VISION' | 'GENERAL' {
  if (/(前期|对线|开局|1级|3级|6级|early|lane)/i.test(question)) return 'EARLY';
  if (/(中期|转线|节奏|运营|mid)/i.test(question)) return 'MID';
  if (/(团战|开团|站位|进场|秒表|teamfight)/i.test(question)) return 'TEAMFIGHT';
  if (/(小龙|大龙|先锋|资源|objective|baron|dragon)/i.test(question)) return 'OBJECTIVE';
  if (/(视野|眼位|排眼|河道|vision|ward)/i.test(question)) return 'VISION';
  return 'GENERAL';
}

function pickTimelineEvidence(
  timeline: import('../../../domain').MatchTimeline | undefined,
  focus: 'EARLY' | 'MID' | 'TEAMFIGHT' | 'OBJECTIVE' | 'VISION' | 'GENERAL'
): string[] {
  if (!timeline?.events?.length) return [];

  const matchByFocus = timeline.events.filter((event) => {
    if (focus === 'EARLY') return event.minute <= 10;
    if (focus === 'MID') return event.minute > 10 && event.minute <= 22;
    if (focus === 'TEAMFIGHT') return event.type === 'KILL' || event.type === 'DEATH' || event.type === 'TEAMFIGHT';
    if (focus === 'OBJECTIVE') return event.type === 'OBJECTIVE';
    if (focus === 'VISION') return event.type === 'VISION';
    return true;
  });

  return matchByFocus.slice(0, 4).map((event) => `${event.minute}分：${event.note}`);
}

function composeContextAwareAnswer(input: {
  question: string;
  match: MatchDetail;
  basic: BasicReviewReport;
  deep?: DeepReviewResult;
  timelineEvidence: string[];
}): MatchAskAnswer['answer'] {
  const { question, match, basic, deep, timelineEvidence } = input;
  const focus = inferFocus(question);
  const keyIssue = basic.sections[2]?.lines[0] ?? '中期节奏转换仍有优化空间';
  const keyAdvice = basic.sections[4]?.lines[0] ?? '建议先信息后动作，降低高风险换子';
  const deepInsight = deep?.render_payload.sections[0]?.insight;
  const kda = `${match.kills}/${match.deaths}/${match.assists}`;

  const focusLabel: Record<typeof focus, string> = {
    EARLY: '前期/对线',
    MID: '中期运营',
    TEAMFIGHT: '团战处理',
    OBJECTIVE: '资源决策',
    VISION: '视野博弈',
    GENERAL: '全局复盘',
  };

  return {
    summary: `关于你问的“${question}”，结合这局 ${match.championName}（${match.queue}，${match.outcome === 'WIN' ? '胜' : '负'}，KDA ${kda}），当前最关键的问题是：${deepInsight ?? keyIssue}`,
    sections: [
      {
        section_title: `结论（${focusLabel[focus]}）`,
        insight: deepInsight ?? keyIssue,
        evidence: timelineEvidence.length > 0 ? timelineEvidence : [basic.sections[1]?.lines[0] ?? '已结合本局复盘关键点'],
        advice: keyAdvice,
        tags: ['match-context', focusLabel[focus], 'timeline'],
        severity: 'MEDIUM',
      },
      {
        section_title: '下一局可执行动作',
        insight: '先把高风险决策从“习惯动作”降为“有信息再动作”，你的稳定性会明显提升。',
        evidence: [basic.sections[1]?.lines[1] ?? '资源与团战节点是本局胜负分水岭'],
        advice: `1）10分钟前优先稳线和河道信息；2）中期资源前20秒站位；3）团战前确认关键技能与视野。`,
        tags: ['action-plan', 'coaching'],
        severity: 'LOW',
      },
    ],
  };
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

  async linkMockAccount(
    userId: string,
    region: Region,
    request?: { gameName?: string; tagLine?: string }
  ): Promise<LinkedAccount> {
    const provider = this.registries.accountRegistry.get(region);
    return provider.linkAccountMock(userId, request);
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

  async getMatchTimeline(region: Region, matchId: string): Promise<import('../../../domain').MatchTimeline | undefined> {
    try {
      const bundle = await this.matchUseCase.getMatchBundle(region, matchId);
      return bundle.timeline;
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
      ref: [],
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

    const [basic, timeline] = await Promise.all([
      this.generateBasicReview(match, input.nowIso),
      this.getMatchTimeline(input.region, input.matchId),
    ]);
    sharedDeepReviewRepository.markBasicReviewGenerated(input.userId, input.matchId, input.region, input.nowIso);

    const deep = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    const focus = inferFocus(input.question);
    const timelineEvidence = pickTimelineEvidence(timeline, focus);
    const answer = composeContextAwareAnswer({
      question: input.question,
      match,
      basic,
      deep,
      timelineEvidence,
    });

    const response: MatchAskAnswer = {
      status: 'ANSWERED',
      answer,
      cited_from: {
        basic_review: true,
        deep_review: Boolean(deep || timelineEvidence.length),
      },
      suggested_prompts: deep
        ? [
            '如果只改一个习惯，优先改哪个收益最高？',
            '请给我 10/15/20 分钟的执行清单。',
            '同样对线情况下，更稳妥的处理方案是什么？',
          ]
        : [
            '这局我最需要先修正的失误是什么？',
            '哪一个时间点的决策代价最大？',
            '下一局前 3 分钟我该优先做什么？',
          ],
    };

    sharedDeepReviewRepository.addConversationMessage({
      conversation_id: conversation.conversation_id,
      user_id: input.userId,
      match_id: input.matchId,
      role: 'AGENT',
      content: response.answer?.summary ?? summarizeBasic(basic),
      ref: deep ? ['BASIC_REVIEW', 'DEEP_REVIEW'] : ['BASIC_REVIEW'],
      created_at: input.nowIso,
    });

    return response;
  }

  async listSuggestedPrompts(input: { userId: string; matchId: string; nowIso: string }): Promise<string[]> {
    const deep = sharedDeepReviewRepository.getLatestResult(input.userId, input.matchId);
    if (deep) {
      return [
        '哪波团战的站位问题最严重？',
        '这局什么时候应该转成更保守的出装？',
        '我该怎么把对线优势转成目标控制？',
      ];
    }
    return [
      '这局我最需要先改掉的三个问题是什么？',
      '为什么我的中期会断节奏？',
      '下一局开局 3 分钟我该怎么打更稳？',
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
