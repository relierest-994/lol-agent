import type { MatchDetail } from '../../../domain';
import type { BasicReviewSignals } from '../../../domain/review/types';

export class BasicSummaryComposer {
  composeOverall(match: MatchDetail, signals: BasicReviewSignals): string {
    const kda = ((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(2);
    const outcome = match.outcome === 'WIN' ? '拿下胜利' : '遗憾落败';
    const grade = this.grade(signals);
    const vibe =
      grade === 'A'
        ? '这把属于“教科书式上分素材”，连解说都想给你回放。'
        : grade === 'B'
          ? '这把整体在线，偶有“差一口气”的名场面。'
          : grade === 'C'
            ? '这把是“有操作但节奏掉线”的经典局，梗图潜质很高。'
            : '这把属于“前排吃瓜也能看出问题”的局，但可修复空间巨大。';
    return `你这把用 ${match.championName} 在 ${match.queue}${outcome}，KDA ${kda}，综合评级 ${grade}。${vibe}`;
  }

  composeKeyFactors(signals: BasicReviewSignals): string[] {
    const lines: string[] = [];

    if (signals.resourceScore < 40) {
      lines.push('资源团存在“我方开会你在路上”的情况，关键龙/先锋参与偏晚。');
    } else {
      lines.push('资源团参与稳定，关键中立资源点你基本都在场。');
    }

    if (signals.deathValueScore < 50) {
      lines.push('中前期有几波“上头送温暖”，高价值阵亡让节奏被反手接管。');
    } else {
      lines.push('死亡控制不错，在线时长和地图存在感保持得住。');
    }

    if (signals.teamfightScore >= 65) {
      lines.push('团战处理在线，关键团能打出该有的职业级站位和技能价值。');
    } else {
      lines.push('团战常见“提前进场”，建议等控制链到位再进，别做第一个吃技能的人。');
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
