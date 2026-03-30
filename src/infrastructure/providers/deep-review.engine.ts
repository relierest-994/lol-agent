import type {
  BasicReviewReport,
  DeepReviewDimension,
  DeepReviewResult,
  MatchDetail,
  ReviewEvidence,
  ReviewInsight,
  ReviewSuggestion,
} from '../../domain';

function id(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

const ALL_DIMENSIONS: DeepReviewDimension[] = [
  'LANING',
  'MIDGAME_TEMPO',
  'RESOURCE_CONTROL',
  'TEAMFIGHT',
  'BUILD_SKILL_PATH',
  'ROLE_SPECIFIC',
];

function inferSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score < 45) return 'HIGH';
  if (score < 65) return 'MEDIUM';
  return 'LOW';
}

function timestamp(minute: number): string {
  const mm = String(Math.max(0, minute)).padStart(2, '0');
  return `00:${mm}:00`;
}

function evidenceFromMatch(match: MatchDetail, basic: BasicReviewReport): ReviewEvidence[] {
  const events = [
    ...(match.timelineSignals.earlyDeaths > 0
      ? [
          {
            source_type: 'MATCH_SIGNAL' as const,
            description: `前期死亡次数 ${match.timelineSignals.earlyDeaths} 次，影响对线主动权`,
            related_timestamp: timestamp(8),
            confidence: 0.82,
          },
        ]
      : []),
    {
      source_type: 'MATCH_SIGNAL' as const,
      description: `目标参与率 ${Math.round(match.timelineSignals.objectiveParticipation * 100)}%`,
      related_timestamp: timestamp(18),
      confidence: 0.74,
    },
    {
      source_type: 'MATCH_SIGNAL' as const,
      description: `视野分 ${match.timelineSignals.visionScore.toFixed(1)}，影响团战前站位信息`,
      related_timestamp: timestamp(22),
      confidence: 0.77,
    },
    {
      source_type: 'BASIC_REVIEW' as const,
      description: `基础复盘关键点：${basic.sections[1].lines[0] ?? '节奏控制需要优化'}`,
      related_timestamp: timestamp(20),
      confidence: 0.7,
    },
  ];

  return events.map((item, idx) => ({
    evidence_id: id('ev', idx),
    ...item,
  }));
}

export class DeepReviewEngine {
  generate(input: {
    match: MatchDetail;
    basicReview: BasicReviewReport;
    focusDimensions?: DeepReviewDimension[];
    userId: string;
    matchId: string;
    taskId: string;
    nowIso: string;
  }): Omit<DeepReviewResult, 'result_id' | 'cached'> {
    const dimensions = input.focusDimensions?.length ? input.focusDimensions : ALL_DIMENSIONS;
    const evidence = evidenceFromMatch(input.match, input.basicReview);
    const signals = input.basicReview.diagnostics.signals;

    const insights: ReviewInsight[] = dimensions.map((dimension, idx) => {
      const score =
        dimension === 'LANING'
          ? signals.laningScore
          : dimension === 'MIDGAME_TEMPO'
            ? signals.deathValueScore
            : dimension === 'RESOURCE_CONTROL'
              ? signals.resourceScore
              : dimension === 'TEAMFIGHT'
                ? signals.teamfightScore
                : dimension === 'BUILD_SKILL_PATH'
                  ? signals.economyScore
                  : Math.round((signals.laningScore + signals.teamfightScore) / 2);

      const severity = inferSeverity(score);
      const sectionTitle =
        dimension === 'LANING'
          ? '对线'
          : dimension === 'MIDGAME_TEMPO'
            ? '中期节奏'
            : dimension === 'RESOURCE_CONTROL'
              ? '资源控制'
              : dimension === 'TEAMFIGHT'
                ? '团战处理'
                : dimension === 'BUILD_SKILL_PATH'
                  ? '装备 / 技能路径'
                  : '英雄/位置专项建议';

      const coreAdvice =
        severity === 'HIGH'
          ? `${sectionTitle}存在明显短板，建议先稳定视野与进场时机`
          : severity === 'MEDIUM'
            ? `${sectionTitle}有提升空间，建议加强关键时间点决策`
            : `${sectionTitle}表现稳定，继续保持当前执行节奏`;

      return {
        insight_id: id('insight', idx),
        section_title: sectionTitle,
        dimension,
        severity,
        insight: `${sectionTitle}评分 ${score}/100，主要瓶颈与中期转换和信息利用相关`,
        evidence: evidence.slice(0, 2),
        advice: coreAdvice,
        tags: [dimension.toLowerCase(), severity.toLowerCase(), input.match.championName.toLowerCase()],
        related_timestamp: evidence[idx % evidence.length]?.related_timestamp,
      };
    });

    const suggestions: ReviewSuggestion[] = insights.slice(0, 5).map((insight, idx) => ({
      suggestion_id: id('sug', idx),
      advice: insight.advice,
      tags: insight.tags,
      priority: insight.severity === 'HIGH' ? 'HIGH' : insight.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
    }));

    return {
      task_id: input.taskId,
      user_id: input.userId,
      match_id: input.matchId,
      status: 'COMPLETED',
      dimensions,
      structured_insights: insights,
      evidence_list: evidence,
      suggestion_list: suggestions,
      render_payload: {
        summary: `深度复盘已完成，共分析 ${dimensions.length} 个维度`,
        sections: insights.map((insight) => ({
          section_title: insight.section_title,
          severity: insight.severity,
          insight: insight.insight,
          evidence: insight.evidence.map((item) => item.description),
          advice: insight.advice,
          tags: insight.tags,
          related_timestamp: insight.related_timestamp,
        })),
      },
      generated_at: input.nowIso,
    };
  }
}
