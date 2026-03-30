import type { DeepReviewResult, MatchAskAnswer } from '../../../domain';
import { mapProviderError } from '../provider-error.mapper';

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    const mapped = mapProviderError(error);
    throw new Error(`INVALID_RESPONSE: ${mapped.message}`);
  }
}

function asSeverity(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') return value;
  return 'MEDIUM';
}

export function normalizeDeepReviewSections(input: string): {
  summary?: string;
  sections?: DeepReviewResult['render_payload']['sections'];
} {
  const parsed = parseJson(input) as {
    summary?: unknown;
    sections?: unknown[];
  };

  const sections = (parsed.sections ?? [])
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      section_title: String(item.section_title ?? 'Deep Review'),
      severity: asSeverity(item.severity),
      insight: String(item.insight ?? ''),
      evidence: Array.isArray(item.evidence) ? item.evidence.map((e) => String(e)) : [],
      advice: String(item.advice ?? ''),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
      related_timestamp: item.related_timestamp ? String(item.related_timestamp) : undefined,
    }))
    .filter((item) => item.insight.length > 0 && item.advice.length > 0);

  return {
    summary: parsed.summary ? String(parsed.summary) : undefined,
    sections: sections.length ? sections : undefined,
  };
}

export function normalizeMatchAskAnswer(input: string, hasDeep: boolean): MatchAskAnswer {
  const parsed = parseJson(input) as {
    status?: unknown;
    answer?: {
      summary?: unknown;
      sections?: unknown[];
    };
    suggested_prompts?: unknown[];
  };

  const status = parsed.status === 'NEEDS_DEEP_REVIEW' ? 'NEEDS_DEEP_REVIEW' : 'ANSWERED';
  const sections = (parsed.answer?.sections ?? [])
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      section_title: String(item.section_title ?? 'Match Answer'),
      insight: String(item.insight ?? ''),
      evidence: Array.isArray(item.evidence) ? item.evidence.map((e) => String(e)) : [],
      advice: String(item.advice ?? ''),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : ['match-context'],
      severity: asSeverity(item.severity),
    }))
    .filter((item) => item.insight.length > 0);

  return {
    status,
    answer:
      status === 'ANSWERED'
        ? {
            summary: String(parsed.answer?.summary ?? 'Answer generated from match context.'),
            sections: sections.length
              ? sections
              : [
                  {
                    section_title: 'Match Answer',
                    insight: 'Unable to parse detailed sections; returning concise contextual answer.',
                    evidence: [],
                    advice: 'Review the key decision points and re-ask with a narrower timestamp.',
                    tags: ['fallback'],
                    severity: 'MEDIUM',
                  },
                ],
          }
        : undefined,
    cited_from: {
      basic_review: true,
      deep_review: hasDeep,
    },
    suggested_prompts: Array.isArray(parsed.suggested_prompts)
      ? parsed.suggested_prompts.map((item) => String(item)).slice(0, 5)
      : ['What is the highest-impact change for next game?'],
  };
}
