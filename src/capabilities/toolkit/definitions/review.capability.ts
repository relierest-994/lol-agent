import type { DeepReviewDimension, EntitlementFeature, Region } from '../../../domain';
import { STANDARD_ERROR_SCHEMA, entitlementRequired, invalidInput, notFound, providerError, unauthorized } from '../errors';
import type { CapabilityDefinition, CapabilitySchema } from '../types';
import { defaultRateLimiter } from '../../../infrastructure/security/rate-limiter';

export interface ReviewGenerateBasicInput {
  userId: string;
  region: Region;
  accountId: string;
  matchId: string;
  context?: string;
}

export interface ReviewGenerateBasicOutput {
  report: import('../../../domain').BasicReviewReport;
  matchSummary: {
    matchId: string;
    championName: string;
    queue: string;
    outcome: 'WIN' | 'LOSS';
    kda: string;
    durationMinutes: number;
    playedAt: string;
  };
  winLossKeyFactors: string[];
  issuesTop3: string[];
  highlightsTop3: string[];
  nextSuggestionsTop3: string[];
}

function countEarlyDeaths(timeline: import('../../../domain').MatchTimeline | undefined): number {
  if (!timeline) return 0;
  return timeline.events.filter((event) => event.type === 'DEATH' && event.minute <= 10).length;
}

const dimensionEnum: DeepReviewDimension[] = [
  'LANING',
  'MIDGAME_TEMPO',
  'RESOURCE_CONTROL',
  'TEAMFIGHT',
  'BUILD_SKILL_PATH',
  'ROLE_SPECIFIC',
];

const deepReviewInputSchema: CapabilitySchema = {
  type: 'object',
  required: ['user_id', 'region', 'account_id', 'match_id', 'authorization_context'],
  properties: {
    user_id: { type: 'string', description: 'User id' },
    region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
    account_id: { type: 'string', description: 'Account id' },
    match_id: { type: 'string', description: 'Match id' },
    focus_dimensions: { type: 'array', description: 'Optional target dimensions' },
    authorization_context: { type: 'object', description: 'Authorization context passed by agent' },
  },
};

export const reviewGenerateBasicCapability: CapabilityDefinition<
  ReviewGenerateBasicInput,
  ReviewGenerateBasicOutput
> = {
  id: 'review.generate_basic',
  title: 'Generate basic review report',
  inputSchema: {
    type: 'object',
    required: ['userId', 'region', 'accountId', 'matchId'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
      accountId: { type: 'string', description: 'Account id' },
      matchId: { type: 'string', description: 'Target match id' },
      context: { type: 'string', description: 'Optional natural language context' },
    },
  },
  outputSchema: {
    type: 'object',
    required: [
      'report',
      'matchSummary',
      'winLossKeyFactors',
      'issuesTop3',
      'highlightsTop3',
      'nextSuggestionsTop3',
    ],
    properties: {
      matchSummary: { type: 'object', description: 'Selected match summary' },
      report: { type: 'object', description: 'Structured review report for agent rendering' },
      winLossKeyFactors: { type: 'array', description: 'Win/loss key factors' },
      issuesTop3: { type: 'array', description: 'Top 3 issues' },
      highlightsTop3: { type: 'array', description: 'Top 3 highlights' },
      nextSuggestionsTop3: { type: 'array', description: 'Top 3 next suggestions' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Basic review is free',
  },
  async invoke(context, input, provider) {
    if (!input.accountId || !input.matchId) return invalidInput('accountId and matchId are required');

    try {
      const [detail, timeline] = await Promise.all([
        provider.getMatchDetail(input.region, input.matchId),
        provider.getMatchTimeline(input.region, input.matchId),
      ]);
      if (!detail) return notFound(`Match not found: ${input.matchId}`);

      const enrichedDetail: import('../../../domain').MatchDetail = {
        ...detail,
        timelineSignals: {
          ...detail.timelineSignals,
          earlyDeaths: countEarlyDeaths(timeline),
        },
      };

      const report = await provider.generateBasicReview(enrichedDetail, context.nowIso);
      const kda = ((enrichedDetail.kills + enrichedDetail.assists) / Math.max(enrichedDetail.deaths, 1)).toFixed(2);

      return {
        ok: true,
        data: {
          report,
          matchSummary: {
            matchId: enrichedDetail.matchId,
            championName: enrichedDetail.championName,
            queue: enrichedDetail.queue,
            outcome: enrichedDetail.outcome,
            kda,
            durationMinutes: enrichedDetail.durationMinutes,
            playedAt: enrichedDetail.playedAt,
          },
          winLossKeyFactors: report.sections[1]?.lines ?? [],
          issuesTop3: report.sections[2]?.lines.slice(0, 3) ?? [],
          highlightsTop3: report.sections[3]?.lines.slice(0, 3) ?? [],
          nextSuggestionsTop3: report.sections[4]?.lines.slice(0, 3) ?? [],
        },
      };
    } catch (error) {
      return providerError('Failed to generate basic review', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const reviewDeepGenerateCapability: CapabilityDefinition<
  {
    user_id: string;
    region: Region;
    account_id: string;
    match_id: string;
    focus_dimensions?: DeepReviewDimension[];
    authorization_context: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
  },
  {
    status: 'COMPLETED';
    task_id: string;
    cached: boolean;
    dimensions: DeepReviewDimension[];
    structured_insights: import('../../../domain').ReviewInsight[];
    evidence_list: import('../../../domain').ReviewEvidence[];
    suggestion_list: import('../../../domain').ReviewSuggestion[];
    render_payload: import('../../../domain').DeepReviewResult['render_payload'];
  }
> = {
  id: 'review.deep.generate',
  title: 'Generate deep review for one match',
  inputSchema: deepReviewInputSchema,
  outputSchema: {
    type: 'object',
    required: [
      'status',
      'task_id',
      'cached',
      'dimensions',
      'structured_insights',
      'evidence_list',
      'suggestion_list',
      'render_payload',
    ],
    properties: {
      status: { type: 'string', description: 'Task status' },
      task_id: { type: 'string', description: 'Task id' },
      cached: { type: 'boolean', description: 'Whether reused cached result' },
      dimensions: { type: 'array', description: 'Analyzed dimensions' },
      structured_insights: { type: 'array', description: 'Structured insights' },
      evidence_list: { type: 'array', description: 'Evidence list' },
      suggestion_list: { type: 'array', description: 'Suggestion list' },
      render_payload: { type: 'object', description: 'UI render payload' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Deep review is included in base review experience',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.user_id) return unauthorized('user_id does not match authenticated context');
    const rate = defaultRateLimiter.consume({
      key: `deep-review:${context.userId}`,
      limit: 6,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return invalidInput('Deep review rate limit exceeded', `retry_after_ms=${rate.reset_after_ms}`);
    }
    if (!input.user_id || !input.match_id || !input.account_id) {
      return invalidInput('user_id, account_id, match_id are required');
    }
    if (input.focus_dimensions && input.focus_dimensions.some((item) => !dimensionEnum.includes(item))) {
      return invalidInput(`focus_dimensions must be one of: ${dimensionEnum.join(', ')}`);
    }

    try {
      const deep = await provider.generateDeepReview({
        userId: input.user_id,
        region: input.region,
        accountId: input.account_id,
        matchId: input.match_id,
        focusDimensions: input.focus_dimensions,
        authorizationContext: input.authorization_context,
        nowIso: context.nowIso,
      });

      return {
        ok: true,
        data: {
          status: 'COMPLETED',
          task_id: deep.task.task_id,
          cached: deep.fromCache,
          dimensions: deep.result.dimensions,
          structured_insights: deep.result.structured_insights,
          evidence_list: deep.result.evidence_list,
          suggestion_list: deep.result.suggestion_list,
          render_payload: deep.result.render_payload,
        },
      };
    } catch (error) {
      return providerError('Failed to generate deep review', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const reviewDeepGetCapability: CapabilityDefinition<
  { user_id: string; match_id: string },
  {
    status: 'NOT_FOUND' | 'COMPLETED';
    cached: boolean;
    result?: import('../../../domain').DeepReviewResult;
  }
> = {
  id: 'review.deep.get',
  title: 'Get cached deep review result',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'match_id'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      match_id: { type: 'string', description: 'Match id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status', 'cached'],
    properties: {
      status: { type: 'string', description: 'Cache status' },
      cached: { type: 'boolean', description: 'Whether output is from cache' },
      result: { type: 'object', description: 'Deep review result if exists' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Deep review cache lookup',
  },
  async invoke(context, input, provider) {
    if (!input.user_id || !input.match_id) return invalidInput('user_id and match_id are required');
    try {
      const result = await provider.getDeepReviewResult({
        userId: input.user_id,
        matchId: input.match_id,
        nowIso: context.nowIso,
      });
      if (!result) {
        return { ok: true, data: { status: 'NOT_FOUND', cached: false } };
      }
      return {
        ok: true,
        data: {
          status: 'COMPLETED',
          cached: true,
          result,
        },
      };
    } catch (error) {
      return providerError('Failed to get deep review', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const reviewDeepStatusCapability: CapabilityDefinition<
  { user_id: string; match_id: string },
  {
    status: 'NOT_FOUND' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    task?: import('../../../domain').DeepReviewTask;
  }
> = {
  id: 'review.deep.status',
  title: 'Get deep review task status',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'match_id'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      match_id: { type: 'string', description: 'Match id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', description: 'Task status' },
      task: { type: 'object', description: 'Task detail when available' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Task status lookup',
  },
  async invoke(context, input, provider) {
    if (!input.user_id || !input.match_id) return invalidInput('user_id and match_id are required');
    try {
      const status = await provider.getDeepReviewStatus({
        userId: input.user_id,
        matchId: input.match_id,
        nowIso: context.nowIso,
      });
      return {
        ok: true,
        data: {
          status: status.status,
          task: status.task,
        },
      };
    } catch (error) {
      return providerError('Failed to get deep review status', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const reviewAskMatchCapability: CapabilityDefinition<
  {
    user_id: string;
    region: Region;
    match_id: string;
    question: string;
    authorization_context: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
  },
  {
    status: 'ANSWERED' | 'NEEDS_DEEP_REVIEW' | 'PAYWALL_REQUIRED';
    answer?: import('../../../domain').MatchAskAnswer['answer'];
    cited_from: import('../../../domain').MatchAskAnswer['cited_from'];
    paywall_action?: import('../../../domain').MatchAskAnswer['paywall_action'];
    suggested_prompts: string[];
  }
> = {
  id: 'review.ask.match',
  title: 'Ask question around single match context',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'region', 'match_id', 'question', 'authorization_context'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
      match_id: { type: 'string', description: 'Match id' },
      question: { type: 'string', description: 'Question around current match context' },
      authorization_context: { type: 'object', description: 'Authorization context passed by agent' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status', 'cited_from', 'suggested_prompts'],
    properties: {
      status: { type: 'string', description: 'Answer status' },
      answer: { type: 'object', description: 'Structured answer payload' },
      cited_from: { type: 'object', description: 'Whether answer cites basic/deep review' },
      paywall_action: { type: 'object', description: 'Paywall action when locked' },
      suggested_prompts: { type: 'array', description: 'Next suggested prompts' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: true,
    feature: 'AI_FOLLOWUP',
    description: 'Match follow-up is paid',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.user_id) return unauthorized('user_id does not match authenticated context');
    const rate = defaultRateLimiter.consume({
      key: `ask-match:${context.userId}`,
      limit: 15,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return invalidInput('AI follow-up rate limit exceeded', `retry_after_ms=${rate.reset_after_ms}`);
    }
    if (!input.user_id || !input.match_id || !input.question) {
      return invalidInput('user_id, match_id, question are required');
    }
    try {
      const askDecision = await provider.checkFeatureAccess(input.user_id, 'AI_FOLLOWUP', context.nowIso);
      if (!askDecision.can_access) {
        return {
          ok: true,
          data: {
            status: 'PAYWALL_REQUIRED',
            cited_from: { basic_review: false, deep_review: false },
            paywall_action: {
              feature_code: 'AI_FOLLOWUP',
              reason_code: askDecision.reason_code,
              display_message: askDecision.display_message,
              paywall_payload: askDecision.paywall_payload,
            },
            suggested_prompts: ['解锁 AI 追问后，可继续按时间点细化分析。'],
          },
        };
      }

      const answer = await provider.askMatchQuestion({
        userId: input.user_id,
        region: input.region,
        matchId: input.match_id,
        question: input.question,
        nowIso: context.nowIso,
      });

      return {
        ok: true,
        data: {
          status: answer.status,
          answer: answer.answer,
          cited_from: answer.cited_from,
          paywall_action: answer.paywall_action,
          suggested_prompts: answer.suggested_prompts,
        },
      };
    } catch (error) {
      return providerError('Failed to answer match follow-up', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const reviewAskSuggestedPromptsCapability: CapabilityDefinition<
  { user_id: string; match_id: string },
  { prompts: string[] }
> = {
  id: 'review.ask.suggested_prompts',
  title: 'Get suggested follow-up prompts for current match',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'match_id'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      match_id: { type: 'string', description: 'Match id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['prompts'],
    properties: {
      prompts: { type: 'array', description: 'Suggested prompts' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Prompt recommendation helper',
  },
  async invoke(context, input, provider) {
    if (!input.user_id || !input.match_id) return invalidInput('user_id and match_id are required');
    try {
      const prompts = await provider.listSuggestedPrompts({
        userId: input.user_id,
        matchId: input.match_id,
        nowIso: context.nowIso,
      });
      return { ok: true, data: { prompts } };
    } catch (error) {
      return providerError('Failed to list suggested prompts', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

function legacyReviewCapability<TInput extends { userId: string; region?: Region; matchId?: string; question?: string }>(
  id: 'review.generate_deep' | 'review.ask_followup',
  title: string,
  feature: EntitlementFeature
): CapabilityDefinition<
  TInput,
  {
    status: string;
    message: string;
    feature_code: EntitlementFeature;
  }
> {
  return {
    id,
    title,
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string', description: 'User id' },
        region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
        matchId: { type: 'string', description: 'Match id' },
        question: { type: 'string', description: 'Question' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['status', 'message', 'feature_code'],
      properties: {
        status: { type: 'string', description: 'Status' },
        message: { type: 'string', description: 'Message' },
        feature_code: { type: 'string', description: 'Feature code' },
      },
    },
    errorSchema: STANDARD_ERROR_SCHEMA,
    entitlement: {
      required: true,
      feature,
      description: `Legacy alias for ${feature}`,
    },
    async invoke(context, input, provider) {
      const decision = await provider.checkFeatureAccess(input.userId, feature, context.nowIso);
      if (!decision.can_access) {
        return entitlementRequired(decision.display_message, decision.reason_code);
      }
      return {
        ok: true,
        data: {
          status: 'LEGACY_OK',
          message: `${id} is deprecated, use review.deep.* or review.ask.match`,
          feature_code: feature,
        },
      };
    },
  };
}

export const reviewGenerateDeepCapability = legacyReviewCapability<{
  userId: string;
  region: Region;
  accountId: string;
  matchId: string;
}>('review.generate_deep', 'Deep review legacy alias', 'DEEP_REVIEW');

export const reviewAskFollowupCapability = legacyReviewCapability<{
  userId: string;
  question: string;
  matchId?: string;
}>('review.ask_followup', 'Follow-up legacy alias', 'AI_FOLLOWUP');

export const reviewAnalyzeClipCapability: CapabilityDefinition<
  {
    userId: string;
    region: Region;
    matchId: string;
    clipId?: string;
  },
  {
    status: 'LOCKED';
    feature_code: 'CLIP_REVIEW';
    message: string;
  }
> = {
  id: 'review.analyze_clip',
  title: 'Clip analysis (phase2 placeholder)',
  inputSchema: {
    type: 'object',
    required: ['userId', 'region', 'matchId'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
      matchId: { type: 'string', description: 'Match id' },
      clipId: { type: 'string', description: 'Optional clip id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status', 'feature_code', 'message'],
    properties: {
      status: { type: 'string', description: 'Status' },
      feature_code: { type: 'string', description: 'Feature code' },
      message: { type: 'string', description: 'Message' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: true,
    feature: 'CLIP_REVIEW',
    description: 'Clip analysis is paid and not yet fully implemented in phase2',
  },
  async invoke(context, input, provider) {
    const decision = await provider.checkFeatureAccess(input.userId, 'CLIP_REVIEW', context.nowIso);
    if (!decision.can_access) {
      return entitlementRequired(decision.display_message, decision.reason_code);
    }
    return {
      ok: true,
      data: {
        status: 'LOCKED',
        feature_code: 'CLIP_REVIEW',
        message: '闂備浇宕甸崰鎰版偡閵夈儙娑樷攽鐎ｃ劉鍋撻崒鐐查唶闁哄洨鍠庢禍閬嶆⒑閹肩偛鍔撮柣鎾崇墦瀹曨剟鎮惧畝鈧壕钘壝归敐鍛暈妞ゃ儮鈧枼鏀介柍钘夋楠炴﹢鏌熸搴⌒ｇ紒缁樼箞瀹曟﹢鍩￠崘銊バㄩ梻浣筋嚙缁绘劗鎹㈤幇顑╂稑螖閳ь剟鏁冮姀銈庢晜闁告侗鍨弸鏍煟鎼搭垳宀涢柡鍛箞椤㈡棃鏌嗗鍡忔嫽闂佸憡鍔﹂崢濂告偂閹邦厹浜滈柡鍌涘濠€浼存煛閸涱厾鍩ｉ柟顔界懇楠炴捇骞掗弮鍌滄殺',
      },
    };
  },
};
