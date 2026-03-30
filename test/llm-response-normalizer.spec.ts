import { describe, expect, it } from 'vitest';
import { normalizeDeepReviewSections, normalizeMatchAskAnswer } from '../src/infrastructure/providers/llm/response-normalizer';

describe('LLM Response Normalizer', () => {
  it('normalizes deep review sections into structured output', () => {
    const normalized = normalizeDeepReviewSections(
      JSON.stringify({
        summary: 'Deep review summary',
        sections: [
          {
            section_title: 'Laning',
            severity: 'HIGH',
            insight: 'Wave state control broke at level 3',
            evidence: ['Minute 3:15 crash failed'],
            advice: 'Hold the wave one extra cycle before roam.',
            tags: ['laning'],
          },
        ],
      })
    );

    expect(normalized.summary).toBe('Deep review summary');
    expect(normalized.sections?.length).toBe(1);
    expect(normalized.sections?.[0]?.section_title).toBe('Laning');
  });

  it('falls back to safe answered payload for sparse ask output', () => {
    const normalized = normalizeMatchAskAnswer(
      JSON.stringify({
        status: 'ANSWERED',
        answer: {
          summary: 'Focus on objective setup',
          sections: [],
        },
      }),
      true
    );

    expect(normalized.status).toBe('ANSWERED');
    expect(normalized.answer?.sections.length).toBeGreaterThan(0);
    expect(normalized.cited_from.deep_review).toBe(true);
  });

  it('throws invalid response on malformed JSON', () => {
    expect(() => normalizeDeepReviewSections('{invalid json')).toThrow('INVALID_RESPONSE');
  });
});
