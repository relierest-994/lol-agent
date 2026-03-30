import { describe, expect, it, vi } from 'vitest';
import type { LlmChatMessage, LlmClient } from '../src/infrastructure/clients';
import type { BasicReviewReport, MatchDetail } from '../src/domain';
import { TextGenerationProvider } from '../src/infrastructure/providers/llm/text-generation.provider';

function createMockLlmClient(responseText: string) {
  return {
    chat: vi.fn(async (_messages: LlmChatMessage[]) => ({ text: responseText, raw: {} })),
  } as unknown as LlmClient;
}

const match: MatchDetail = {
  matchId: 'INTL-1001',
  championName: 'Ahri',
  queue: 'RANKED_SOLO',
  outcome: 'WIN' as const,
  kills: 8,
  deaths: 3,
  assists: 10,
  durationMinutes: 31,
  playedAt: new Date().toISOString(),
  timelineSignals: {
    earlyDeaths: 1,
    objectiveParticipation: 0.7,
    visionScore: 42,
    csPerMinute: 7.5,
    roamingImpact: 0.6,
  },
};

const basicReview: BasicReviewReport = {
  matchId: match.matchId,
  generatedAt: new Date().toISOString(),
  sections: [
    { title: '总评', lines: ['节奏中上，后期团战处理稳定'] },
    { title: '胜负关键', lines: ['二先锋团前排站位更好'] },
    { title: '问题Top3', lines: ['前期换血窗口偏急'] },
    { title: '建议Top3', lines: ['先稳线再转资源点'] },
    { title: '成长总结', lines: ['中期控图有进步'] },
  ],
  diagnostics: {
    signals: {
      laningScore: 70,
      resourceScore: 74,
      deathValueScore: 66,
      teamfightScore: 78,
      economyScore: 72,
    },
    issueTags: [],
    highlightTags: [],
    suggestionTags: ['low_objective_presence'],
  },
};

describe('TextGenerationProvider', () => {
  it('dedupes identical in-flight deep review calls', async () => {
    const client = createMockLlmClient(
      JSON.stringify({
        summary: 'Deep summary',
        sections: [
          {
            section_title: 'Laning',
            severity: 'MEDIUM',
            insight: 'Lane pressure timing unstable',
            evidence: ['3:10 wave push mismatch'],
            advice: 'Reset wave before roam.',
            tags: ['laning'],
          },
        ],
      })
    );
    const provider = new TextGenerationProvider(client);

    const req = {
      match,
      basicReview,
      context: { requestId: 'rid-1' },
    };

    const [a, b] = await Promise.all([provider.generateDeepReviewSections(req), provider.generateDeepReviewSections(req)]);
    expect(a.summary).toBe('Deep summary');
    expect(b.sections?.[0]?.section_title).toBe('Laning');
    expect((client as unknown as { chat: ReturnType<typeof vi.fn> }).chat).toHaveBeenCalledTimes(1);
  });
});
