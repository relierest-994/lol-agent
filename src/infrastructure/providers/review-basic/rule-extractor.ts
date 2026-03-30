import type { MatchDetail } from '../../../domain';
import type { BasicReviewSignals } from '../../../domain/review/types';

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export class BasicReviewRuleExtractor {
  extractSignals(match: MatchDetail): BasicReviewSignals {
    const laningScore = clamp(100 - match.timelineSignals.earlyDeaths * 18 + (match.timelineSignals.csPerMinute - 6) * 8);
    const resourceScore = clamp(match.timelineSignals.objectiveParticipation * 100);
    const deathValueScore = clamp(100 - match.deaths * 9 - match.timelineSignals.earlyDeaths * 5);
    const teamfightScore = clamp(match.timelineSignals.roamingImpact * 100 + match.assists * 2);
    const economyScore = clamp(match.timelineSignals.csPerMinute * 10 + (match.kills + match.assists) * 1.5);

    return {
      laningScore,
      resourceScore,
      deathValueScore,
      teamfightScore,
      economyScore,
    };
  }
}
