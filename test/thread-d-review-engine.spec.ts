import { describe, expect, it } from 'vitest';
import { BasicReviewEngine } from '../src/infrastructure/providers/basic-review.engine';
import { InternationalMatchImportMockProvider } from '../src/infrastructure/providers/match-import/intl/international-match-import.mock-provider';

describe('Thread D - Basic Review Engine', () => {
  it('outputs fixed report structure with stable diagnostics tags', async () => {
    const provider = new InternationalMatchImportMockProvider();
    const detail = await provider.getMatchDetail('EUW-1001');
    if (!detail) throw new Error('Missing mock detail EUW-1001');

    const engine = new BasicReviewEngine();
    const now = '2026-03-30T10:00:00.000Z';
    const report = engine.generate(detail, now);

    expect(report.sections.map((s) => s.title)).toEqual([
      '本局总评',
      '输赢关键点',
      '玩家问题 Top 3',
      '玩家亮点 Top 3',
      '下局建议 Top 3',
    ]);

    expect(report.sections[2].lines).toHaveLength(3);
    expect(report.sections[3].lines).toHaveLength(3);
    expect(report.sections[4].lines).toHaveLength(3);

    expect(report.diagnostics.issueTags).toHaveLength(3);
    expect(report.diagnostics.highlightTags).toHaveLength(3);
    expect(report.diagnostics.suggestionTags.length).toBeGreaterThanOrEqual(3);

    const issueCodes = report.diagnostics.issueTags.map((item) => item.code);
    expect(issueCodes).toContain('low_objective_presence');
    expect(issueCodes.some((code) => code === 'laning_weak' || code === 'overextend_midgame')).toBe(true);
  });

  it('is deterministic given same input and timestamp', async () => {
    const provider = new InternationalMatchImportMockProvider();
    const detail = await provider.getMatchDetail('EUW-1000');
    if (!detail) throw new Error('Missing mock detail EUW-1000');

    const engine = new BasicReviewEngine();
    const now = '2026-03-30T10:00:00.000Z';

    const r1 = engine.generate(detail, now);
    const r2 = engine.generate(detail, now);

    expect(r1).toEqual(r2);
  });
});
