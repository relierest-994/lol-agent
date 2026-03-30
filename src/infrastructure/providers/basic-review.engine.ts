import type { BasicReviewReport, MatchDetail, ReviewTag } from '../../domain';
import { BasicReviewRuleExtractor } from './review-basic/rule-extractor';
import { BasicSummaryComposer } from './review-basic/summary-composer';
import { ReviewTagMapper } from './review-basic/tag-mapper';
import { BasicReviewTemplateMapper } from './review-basic/template-mapper';

function padLines(lines: string[], fallback: string): string[] {
  const result = [...lines];
  while (result.length < 3) {
    result.push(fallback);
  }
  return result.slice(0, 3);
}

function padTags(tags: ReviewTag[], fallback: ReviewTag): ReviewTag[] {
  const result = [...tags];
  while (result.length < 3) {
    result.push(fallback);
  }
  return result.slice(0, 3);
}

export class BasicReviewEngine {
  private readonly extractor = new BasicReviewRuleExtractor();
  private readonly tagMapper = new ReviewTagMapper();
  private readonly templateMapper = new BasicReviewTemplateMapper();
  private readonly composer = new BasicSummaryComposer();

  generate(match: MatchDetail, nowIso: string): BasicReviewReport {
    const signals = this.extractor.extractSignals(match);

    const issueTags = padTags(this.tagMapper.mapIssues(match, signals), {
      type: 'issue',
      code: 'overextend_midgame',
      weight: 0.5,
      reason: '中期节奏仍有优化空间',
    });

    const highlightTags = padTags(this.tagMapper.mapHighlights(match, signals), {
      type: 'highlight',
      code: 'stable_laning',
      weight: 0.5,
      reason: '基础操作与节奏保持稳定',
    });

    const suggestionTags = this.tagMapper.suggestionTagCodes(issueTags, highlightTags);

    const issueLines = padLines(
      this.templateMapper.issueLines(match, issueTags),
      '中后期决策保持先信息后动作，减少无效交换。'
    );

    const highlightLines = padLines(
      this.templateMapper.highlightLines(match, highlightTags),
      '保持当前执行稳定性，持续强化资源节奏。'
    );

    const suggestionLines = this.templateMapper.suggestionLines(suggestionTags);
    const keyFactorLines = this.composer.composeKeyFactors(signals);

    return {
      matchId: match.matchId,
      generatedAt: nowIso,
      sections: [
        {
          title: '本局总评',
          lines: [this.composer.composeOverall(match, signals)],
        },
        {
          title: '输赢关键点',
          lines: keyFactorLines,
        },
        {
          title: '玩家问题 Top 3',
          lines: issueLines,
        },
        {
          title: '玩家亮点 Top 3',
          lines: highlightLines,
        },
        {
          title: '下局建议 Top 3',
          lines: suggestionLines,
        },
      ],
      diagnostics: {
        signals,
        issueTags,
        highlightTags,
        suggestionTags,
      },
    };
  }
}
