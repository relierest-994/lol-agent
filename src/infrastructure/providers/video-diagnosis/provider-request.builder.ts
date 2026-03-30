import type { DeepReviewResult, MatchDetail, MultimodalInputContext, VideoClipAsset } from '../../../domain';

export interface VideoDiagnosisProviderRequest {
  model: string;
  asset_url: string;
  question: string;
  match_context: {
    match_id: string;
    champion_name: string;
    outcome: string;
    queue: string;
    duration_minutes: number;
  };
  deep_review_context?: {
    summary: string;
    key_sections: string[];
  };
  multimodal_context: {
    context_id: string;
    basic_review_summary?: string;
    deep_review_summary?: string;
  };
}

export function buildVideoDiagnosisProviderRequest(input: {
  asset: VideoClipAsset;
  context: MultimodalInputContext;
  match: MatchDetail;
  deepReview?: DeepReviewResult;
  model: string;
}): VideoDiagnosisProviderRequest {
  return {
    model: input.model,
    asset_url: input.asset.storage_path,
    question: input.context.natural_language_question.slice(0, 1200),
    match_context: {
      match_id: input.match.matchId,
      champion_name: input.match.championName,
      outcome: input.match.outcome,
      queue: input.match.queue,
      duration_minutes: input.match.durationMinutes,
    },
    deep_review_context: input.deepReview
      ? {
          summary: input.deepReview.render_payload.summary,
          key_sections: input.deepReview.render_payload.sections.slice(0, 3).map((item) => item.section_title),
        }
      : undefined,
    multimodal_context: {
      context_id: input.context.context_id,
      basic_review_summary: input.context.basic_review_summary,
      deep_review_summary: input.context.deep_review_summary,
    },
  };
}
