import type { MatchDetail, ReviewTag, ReviewTagCode } from '../../../domain';
import type { BasicReviewSignals } from '../../../domain/review/types';

export class ReviewTagMapper {
  mapIssues(match: MatchDetail, signals: BasicReviewSignals): ReviewTag[] {
    const tags: ReviewTag[] = [];

    if (signals.laningScore < 45) {
      tags.push({
        type: 'issue',
        code: 'laning_weak',
        weight: 0.9,
        reason: `前期死亡 ${match.timelineSignals.earlyDeaths} 次，线权不稳定`,
      });
    }

    if (signals.resourceScore < 40) {
      tags.push({
        type: 'issue',
        code: 'low_objective_presence',
        weight: 0.85,
        reason: `资源参与率 ${(match.timelineSignals.objectiveParticipation * 100).toFixed(0)}% 偏低`,
      });
    }

    if (match.timelineSignals.visionScore < 20) {
      tags.push({
        type: 'issue',
        code: 'low_vision_control',
        weight: 0.8,
        reason: `视野得分 ${match.timelineSignals.visionScore}，侧翼信息不足`,
      });
    }

    if (signals.deathValueScore < 45) {
      tags.push({
        type: 'issue',
        code: 'overextend_midgame',
        weight: 0.76,
        reason: `死亡 ${match.deaths} 次，中期操作容错偏低`,
      });
    }

    if (signals.economyScore < 65) {
      tags.push({
        type: 'issue',
        code: 'low_economy_conversion',
        weight: 0.72,
        reason: `补刀效率 ${match.timelineSignals.csPerMinute}/min，经济转化偏慢`,
      });
    }

    return tags.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }

  mapHighlights(match: MatchDetail, signals: BasicReviewSignals): ReviewTag[] {
    const tags: ReviewTag[] = [];

    if (signals.laningScore >= 70) {
      tags.push({
        type: 'highlight',
        code: 'stable_laning',
        weight: 0.82,
        reason: '前期对线稳定，压制与生存平衡较好',
      });
    }

    if (signals.teamfightScore >= 65) {
      tags.push({
        type: 'highlight',
        code: 'strong_teamfight_presence',
        weight: 0.9,
        reason: `团战参与度较高（助攻 ${match.assists}，游走影响 ${match.timelineSignals.roamingImpact.toFixed(2)}）`,
      });
    }

    if (signals.resourceScore >= 50) {
      tags.push({
        type: 'highlight',
        code: 'high_objective_presence',
        weight: 0.86,
        reason: `资源参与率 ${(match.timelineSignals.objectiveParticipation * 100).toFixed(0)}%，具备资源节奏意识`,
      });
    }

    if (match.timelineSignals.roamingImpact >= 0.6) {
      tags.push({
        type: 'highlight',
        code: 'good_roaming_impact',
        weight: 0.79,
        reason: '边路联动效率较好，能制造局部人数优势',
      });
    }

    if (match.kills >= 8) {
      tags.push({
        type: 'highlight',
        code: 'high_damage_pressure',
        weight: 0.74,
        reason: `击杀 ${match.kills}，输出压制力较强`,
      });
    }

    return tags.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }

  suggestionTagCodes(issueTags: ReviewTag[], highlightTags: ReviewTag[]): ReviewTagCode[] {
    const codes = new Set<ReviewTagCode>();
    issueTags.forEach((tag) => codes.add(tag.code));
    highlightTags.forEach((tag) => codes.add(tag.code));
    return Array.from(codes);
  }
}
