import type { MatchDetail, ReviewTag, ReviewTagCode } from '../../../domain';

const issueLineTemplates: Record<ReviewTagCode, (match: MatchDetail, reason: string) => string> = {
  laning_weak: (_m, reason) => `${reason}，建议减少无视野换血并优先控线。`,
  low_objective_presence: (_m, reason) => `${reason}，关键龙团/先锋节点跟进不足。`,
  low_vision_control: (_m, reason) => `${reason}，需提前补足河道与侧翼眼位。`,
  overextend_midgame: (_m, reason) => `${reason}，中期推进与开团需更重视信息差。`,
  low_economy_conversion: (_m, reason) => `${reason}，应先稳补刀再转化击杀窗口。`,
  stable_laning: (_m, reason) => reason,
  strong_teamfight_presence: (_m, reason) => reason,
  high_objective_presence: (_m, reason) => reason,
  good_roaming_impact: (_m, reason) => reason,
  high_damage_pressure: (_m, reason) => reason,
};

const highlightLineTemplates: Record<ReviewTagCode, (match: MatchDetail, reason: string) => string> = {
  stable_laning: (_m, reason) => reason,
  strong_teamfight_presence: (_m, reason) => reason,
  high_objective_presence: (_m, reason) => reason,
  good_roaming_impact: (_m, reason) => reason,
  high_damage_pressure: (_m, reason) => reason,
  laning_weak: (_m, reason) => reason,
  low_objective_presence: (_m, reason) => reason,
  low_vision_control: (_m, reason) => reason,
  overextend_midgame: (_m, reason) => reason,
  low_economy_conversion: (_m, reason) => reason,
};

const suggestionTemplates: Record<ReviewTagCode, string> = {
  laning_weak: '下局前8分钟把前期死亡控制在1次以内，优先保证线权和撤退路径。',
  low_objective_presence: '每次小龙/先锋刷新前45秒提前集合并布控关键入口。',
  low_vision_control: '养成回城后补真眼和河道眼位的节奏，避免无信息开战。',
  overextend_midgame: '中期边线推进时遵循“先看对方关键位再压线”的原则。',
  low_economy_conversion: '设定10分钟补刀目标70+，优先稳定经济曲线。',
  stable_laning: '保持当前对线稳定度，并将优势线权转化为中立资源控制。',
  strong_teamfight_presence: '延续团战进场节奏，优先跟队友控制链同步开战。',
  high_objective_presence: '继续保持资源团出勤率，强化视野后再启动资源争夺。',
  good_roaming_impact: '保持边路联动频率，游走前先推线确保中路线损最小化。',
  high_damage_pressure: '延续输出压制力，团战前确保关键技能和站位安全。',
};

export class BasicReviewTemplateMapper {
  issueLines(match: MatchDetail, tags: ReviewTag[]): string[] {
    return tags.map((tag) => issueLineTemplates[tag.code](match, tag.reason)).slice(0, 3);
  }

  highlightLines(match: MatchDetail, tags: ReviewTag[]): string[] {
    return tags.map((tag) => highlightLineTemplates[tag.code](match, tag.reason)).slice(0, 3);
  }

  suggestionLines(codes: ReviewTagCode[]): string[] {
    const unique = Array.from(new Set(codes));
    const lines = unique.map((code) => suggestionTemplates[code]).filter(Boolean);
    while (lines.length < 3) {
      lines.push('保持稳定心态，围绕视野与资源节奏进行决策复盘。');
    }
    return lines.slice(0, 3);
  }
}
