import type { NormalizedVideoDiagnosis } from './diagnosis.provider';

function asSeverity(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') return value;
  return 'MEDIUM';
}

export function parseVideoProviderResponse(input: unknown): NormalizedVideoDiagnosis {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Video provider response must be an object');
  }

  const payload = input as Record<string, unknown>;
  const findingsRaw = Array.isArray(payload.structured_findings) ? payload.structured_findings : [];
  const findings = findingsRaw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      section_title: String(item.section_title ?? 'Video Diagnosis'),
      severity: asSeverity(item.severity),
      insight: String(item.insight ?? ''),
      evidence: Array.isArray(item.evidence) ? item.evidence.map((e) => String(e)) : [],
      advice: String(item.advice ?? ''),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
      related_timestamp: item.related_timestamp ? String(item.related_timestamp) : undefined,
    }))
    .filter((item) => item.insight.length > 0);

  const keyMomentsRaw = Array.isArray(payload.key_moments) ? payload.key_moments : [];
  const keyMoments = keyMomentsRaw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      timestamp: String(item.timestamp ?? '00:00'),
      event: String(item.event ?? 'Unknown'),
      observation: String(item.observation ?? ''),
    }));

  const summary = String(payload.diagnosis_summary ?? 'Assistive video diagnosis generated.');
  const disclaimers = Array.isArray(payload.disclaimers)
    ? payload.disclaimers.map((item) => String(item))
    : ['This is assistive diagnosis, not an absolute frame-level judgement.'];

  return {
    diagnosis_summary: summary,
    overall_judgement: String(payload.overall_judgement ?? summary),
    likely_issue_types: Array.isArray(payload.likely_issue_types)
      ? payload.likely_issue_types.map((item) => String(item))
      : [],
    key_moments: keyMoments,
    positional_or_trade_error: String(payload.positional_or_trade_error ?? 'Insufficient signal'),
    execution_or_decision_hints: Array.isArray(payload.execution_or_decision_hints)
      ? payload.execution_or_decision_hints.map((item) => String(item))
      : [],
    next_action_advice: Array.isArray(payload.next_action_advice)
      ? payload.next_action_advice.map((item) => String(item))
      : [],
    structured_findings: findings,
    confidence_hints: {
      level: asSeverity((payload.confidence_hints as Record<string, unknown> | undefined)?.level),
      reason: String((payload.confidence_hints as Record<string, unknown> | undefined)?.reason ?? 'Provider normalized response'),
    },
    disclaimers,
    recommended_next_questions: Array.isArray(payload.recommended_next_questions)
      ? payload.recommended_next_questions.map((item) => String(item))
      : [],
    render_payload: {
      cards: findings,
      summary,
      key_moments: keyMoments,
      disclaimers,
    },
  };
}
