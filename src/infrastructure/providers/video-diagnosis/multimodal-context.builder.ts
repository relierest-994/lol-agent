import type { BasicReviewReport, DeepReviewResult, MatchDetail, MultimodalInputContext, VideoClipAsset } from '../../../domain';

export class MultimodalContextBuilder {
  build(input: {
    user_id: string;
    match_id: string;
    asset: VideoClipAsset;
    question: string;
    basicReview?: BasicReviewReport;
    deepReview?: DeepReviewResult;
    match: MatchDetail;
    nowIso: string;
  }): Omit<MultimodalInputContext, 'context_id' | 'created_at'> {
    const basicSummary = input.basicReview
      ? `${input.basicReview.sections[0].lines[0] ?? ''} ${input.basicReview.sections[1].lines[0] ?? ''}`.trim()
      : undefined;
    const deepSummary = input.deepReview?.render_payload.summary;

    return {
      user_id: input.user_id,
      match_id: input.match_id,
      asset_id: input.asset.asset_id,
      natural_language_question: input.question,
      basic_review_summary: basicSummary || `Champion ${input.match.championName}, outcome ${input.match.outcome}`,
      deep_review_summary: deepSummary,
    };
  }
}
