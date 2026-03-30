import type { BasicReviewReport, MatchDetail } from '../../../../domain';
import type { PromptMessage } from '../text-generation.provider';

const MAX_MATCH_JSON = 7000;
const MAX_BASIC_JSON = 5000;

function truncateJson(input: unknown, max: number): string {
  const text = JSON.stringify(input);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function buildDeepReviewPrompt(
  match: MatchDetail,
  basicReview: BasicReviewReport,
  focusDimensions?: string[]
): PromptMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a League of Legends analyst. Return strict JSON only with keys: summary, sections[]. Keep each section concise and evidence-based.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'deep_review',
        focus_dimensions: focusDimensions ?? [],
        constraints: {
          max_sections: 6,
          must_include: ['section_title', 'severity', 'insight', 'evidence', 'advice', 'tags'],
          prohibit: ['generic game knowledge without match context'],
        },
        match_context: truncateJson(match, MAX_MATCH_JSON),
        basic_review_context: truncateJson(basicReview, MAX_BASIC_JSON),
      }),
    },
  ];
}
