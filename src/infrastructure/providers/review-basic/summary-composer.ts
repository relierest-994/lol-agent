import type { MatchDetail } from '../../../domain';
import type { BasicReviewSignals } from '../../../domain/review/types';

export class BasicSummaryComposer {
  composeOverall(match: MatchDetail, signals: BasicReviewSignals): string {
    const kda = ((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(2);
    const outcome = match.outcome === 'WIN' ? '取胜' : '失利';
    const grade = this.grade(signals);
    return `你使用 ${match.championName} 在 ${match.queue} ${outcome}，KDA ${kda}，综合执行评级 ${grade}。`;
  }

  composeKeyFactors(signals: BasicReviewSignals): string[] {
    const lines: string[] = [];

    if (signals.resourceScore < 40) {
      lines.push('资源团参与率偏低，关键龙团与先锋节点影响不足。');
    } else {
      lines.push('资源团参与稳定，对中立资源争夺有持续贡献。');
    }

    if (signals.deathValueScore < 50) {
      lines.push('中前期阵亡价值偏高，导致节奏主动权下降。');
    } else {
      lines.push('死亡控制较好，能维持持续输出和地图存在感。');
    }

    if (signals.teamfightScore >= 65) {
      lines.push('团战参与积极，能在关键团中提供有效影响。');
    } else {
      lines.push('团战进场时机仍可提升，建议先等待控制链再进场。');
    }

    return lines.slice(0, 3);
  }

  private grade(signals: BasicReviewSignals): string {
    const avg = (signals.laningScore + signals.resourceScore + signals.deathValueScore + signals.teamfightScore + signals.economyScore) / 5;
    if (avg >= 75) return 'A';
    if (avg >= 60) return 'B';
    if (avg >= 45) return 'C';
    return 'D';
  }
}
