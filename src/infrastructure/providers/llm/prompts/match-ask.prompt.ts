import type { BasicReviewReport, DeepReviewResult, MatchDetail } from '../../../../domain';
import type { PromptMessage } from '../text-generation.provider';

const MAX_MATCH_JSON = 7000;
const MAX_BASIC_JSON = 5000;
const MAX_DEEP_JSON = 7000;

function truncateJson(input: unknown, max: number): string {
  const text = JSON.stringify(input);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function buildMatchAskPrompt(
  question: string,
  match: MatchDetail,
  basicReview: BasicReviewReport,
  deepReview?: DeepReviewResult
): PromptMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a match-scoped assistant for League of Legends. Answer ONLY with match context. Return strict JSON: status, answer.summary, answer.sections, suggested_prompts.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'match_followup_answer',
        user_question: question.slice(0, 800),
        constraints: {
          prohibit: ['generic tips without current match evidence'],
          status_values: ['ANSWERED', 'NEEDS_DEEP_REVIEW'],
          max_sections: 3,
        },
        match_context: truncateJson(match, MAX_MATCH_JSON),
        basic_review_context: truncateJson(basicReview, MAX_BASIC_JSON),
        deep_review_context: deepReview ? truncateJson(deepReview, MAX_DEEP_JSON) : undefined,
      }),
    },
  ];
}
