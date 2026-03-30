import { describe, expect, it } from 'vitest';
import { parseVideoProviderResponse } from '../src/infrastructure/providers/video-diagnosis/provider-response.parser';

describe('Video Provider Response Parser', () => {
  it('parses structured response into normalized diagnosis', () => {
    const parsed = parseVideoProviderResponse({
      diagnosis_summary: 'Assistive diagnosis',
      overall_judgement: 'Likely over-commit',
      likely_issue_types: ['positioning_overreach'],
      key_moments: [{ timestamp: '00:13', event: 'Re-engage', observation: 'No cooldown window' }],
      positional_or_trade_error: 'Extended past favorable timing',
      execution_or_decision_hints: ['Track cooldowns'],
      next_action_advice: ['Reset before second commit'],
      structured_findings: [
        {
          section_title: 'Positioning',
          severity: 'HIGH',
          insight: 'Stepped beyond safe vision line',
          evidence: ['No flank ward'],
          advice: 'Hold front line anchor.',
          tags: ['vision', 'positioning'],
        },
      ],
      confidence_hints: { level: 'MEDIUM', reason: 'Single clip context' },
      disclaimers: ['Assistive only'],
      recommended_next_questions: ['How should I path after disengage?'],
    });

    expect(parsed.structured_findings.length).toBe(1);
    expect(parsed.render_payload.cards.length).toBe(1);
    expect(parsed.disclaimers[0]).toContain('Assistive');
  });

  it('rejects non-object response payload', () => {
    expect(() => parseVideoProviderResponse('bad-response')).toThrow('must be an object');
  });
});
