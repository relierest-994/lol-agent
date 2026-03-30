import type { VideoDiagnosisFinding } from '../../../domain';
import type { NormalizedVideoDiagnosis, VideoDiagnosisProvider } from './diagnosis.provider';

function scoreToSeverity(durationSeconds: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (durationSeconds < 12) return 'HIGH';
  if (durationSeconds < 25) return 'MEDIUM';
  return 'LOW';
}

export class MockVideoDiagnosisProvider implements VideoDiagnosisProvider {
  async diagnose(input: {
    asset: import('../../../domain').VideoClipAsset;
    match: import('../../../domain').MatchDetail;
    multimodalContext: import('../../../domain').MultimodalInputContext;
  }): Promise<NormalizedVideoDiagnosis> {
    if (/fail-provider/i.test(input.multimodalContext.natural_language_question)) {
      throw new Error('Mock provider forced failure');
    }

    const severity = scoreToSeverity(input.asset.duration_seconds);
    const findings: VideoDiagnosisFinding[] = [
      {
        section_title: 'Overall Trade',
        severity,
        insight: 'The clip suggests a disadvantageous re-engage timing after resources were already traded.',
        evidence: ['Cooldowns likely mismatched', 'Enemy spacing remained healthier at re-entry'],
        advice: 'Stop the chase earlier and reset formation before re-entering.',
        tags: ['trade', 'timing', 're-engage'],
        related_timestamp: '00:12',
      },
      {
        section_title: 'Positioning',
        severity: severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        insight: 'Positioning drifts forward without vision certainty, increasing collapse risk.',
        evidence: ['No secure flank information', 'Forward movement before ally sync'],
        advice: 'Anchor around vision line and wait one extra beat for ally follow-up.',
        tags: ['positioning', 'vision'],
        related_timestamp: '00:18',
      },
    ];

    const summary = `Clip diagnosis is an assistive judgement for match ${input.match.matchId}, not a frame-perfect verdict.`;

    return {
      diagnosis_summary: summary,
      overall_judgement: 'Likely losing trade from timing + positioning mismatch',
      likely_issue_types: ['timing_mismatch', 'positioning_overreach'],
      key_moments: [
        { timestamp: '00:12', event: 'Re-engage', observation: 'Re-engage begins before reset window' },
        { timestamp: '00:18', event: 'Forward drift', observation: 'Positioning advances beyond safe information line' },
      ],
      positional_or_trade_error: 'Trade extended longer than the favorable spike window.',
      execution_or_decision_hints: [
        'Check ally cooldown/state before second commit',
        'Do not chain chase past vision break unless objective value is high',
      ],
      next_action_advice: [
        'Practice two-step disengage into re-entry timing',
        'Use a hard stop call when key cooldowns are down',
      ],
      structured_findings: findings,
      confidence_hints: {
        level: severity === 'HIGH' ? 'MEDIUM' : 'HIGH',
        reason: 'Short clip context and no full-map state prevent absolute judgement',
      },
      disclaimers: [
        'This is an assistive diagnosis, not an absolute frame-by-frame adjudication.',
        'Conclusion confidence depends on clip completeness and camera perspective.',
      ],
      recommended_next_questions: [
        'If I stop at 00:12, what is the safer next action?',
        'Which cooldown checkpoint should I verify before re-engaging?',
        'How should I reposition if vision is incomplete at this timing?',
      ],
      render_payload: {
        cards: findings,
        summary,
        key_moments: [
          { timestamp: '00:12', event: 'Re-engage', observation: 'Likely over-commit timing' },
          { timestamp: '00:18', event: 'Position drift', observation: 'Forward move without safe info line' },
        ],
        disclaimers: [
          'Assistive diagnosis only, not absolute judgement.',
          'Result quality depends on clip quality and context.',
        ],
      },
    };
  }
}
