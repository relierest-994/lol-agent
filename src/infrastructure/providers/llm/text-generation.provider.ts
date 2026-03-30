import type { BasicReviewReport, DeepReviewResult, MatchAskAnswer, MatchDetail } from '../../../domain';
import type { LlmChatMessage } from '../../clients';
import { LlmClient } from '../../clients';
import { mapProviderError } from '../provider-error.mapper';
import { buildDeepReviewPrompt } from './prompts/deep-review.prompt';
import { buildMatchAskPrompt } from './prompts/match-ask.prompt';
import { normalizeDeepReviewSections, normalizeMatchAskAnswer } from './response-normalizer';

export interface LlmCallContext {
  traceId?: string;
  requestId: string;
}

interface InflightEntry<T> {
  createdAt: number;
  promise: Promise<T>;
}

const DEDUPE_WINDOW_MS = 15_000;

export class TextGenerationProvider {
  private readonly inflight = new Map<string, InflightEntry<unknown>>();

  constructor(private readonly client: LlmClient) {}

  async generateDeepReviewSections(input: {
    match: MatchDetail;
    basicReview: BasicReviewReport;
    focusDimensions?: string[];
    context: LlmCallContext;
  }): Promise<{
    summary?: string;
    sections?: DeepReviewResult['render_payload']['sections'];
  }> {
    const messages = buildDeepReviewPrompt(input.match, input.basicReview, input.focusDimensions);
    const key = `deep:${input.match.matchId}:${JSON.stringify(input.focusDimensions ?? [])}`;
    return this.runDedupe(key, async () => {
      try {
        const response = await this.client.chat(messages, 0.2, {
          'x-trace-id': input.context.traceId ?? '',
          'x-client-request-id': input.context.requestId,
        });
        return normalizeDeepReviewSections(response.text);
      } catch (error) {
        const mapped = mapProviderError(error);
        if (!mapped.retryable) throw new Error(mapped.message);
        throw new Error(`${mapped.message}: ${mapped.details ?? ''}`.trim());
      }
    });
  }

  async answerMatchQuestion(input: {
    question: string;
    match: MatchDetail;
    basicReview: BasicReviewReport;
    deepReview?: DeepReviewResult;
    context: LlmCallContext;
  }): Promise<MatchAskAnswer> {
    const messages = buildMatchAskPrompt(input.question, input.match, input.basicReview, input.deepReview);
    const key = `ask:${input.match.matchId}:${input.question.trim().toLowerCase()}`;
    return this.runDedupe(key, async () => {
      try {
        const response = await this.client.chat(messages, 0.3, {
          'x-trace-id': input.context.traceId ?? '',
          'x-client-request-id': input.context.requestId,
        });
        return normalizeMatchAskAnswer(response.text, Boolean(input.deepReview));
      } catch (error) {
        const mapped = mapProviderError(error);
        if (!mapped.retryable) throw new Error(mapped.message);
        throw new Error(`${mapped.message}: ${mapped.details ?? ''}`.trim());
      }
    });
  }

  private async runDedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.inflight.get(key);
    if (existing && now - existing.createdAt < DEDUPE_WINDOW_MS) {
      return existing.promise as Promise<T>;
    }

    const promise = run().finally(() => {
      const current = this.inflight.get(key);
      if (current?.promise === promise) this.inflight.delete(key);
    });
    this.inflight.set(key, { createdAt: now, promise });
    return promise;
  }
}

export type PromptMessage = LlmChatMessage;
