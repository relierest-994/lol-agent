import type { DeepReviewResult, MatchDetail, MultimodalInputContext, VideoClipAsset } from '../../../domain';
import { VideoProviderClient } from '../../clients';
import { mapProviderError } from '../provider-error.mapper';
import type { NormalizedVideoDiagnosis, VideoDiagnosisProvider } from './diagnosis.provider';
import { buildVideoDiagnosisProviderRequest } from './provider-request.builder';
import { parseVideoProviderResponse } from './provider-response.parser';

export interface VideoDiagnosisCallContext {
  traceId?: string;
  requestId: string;
}

export class RealVideoDiagnosisProvider implements VideoDiagnosisProvider {
  constructor(
    private readonly client: VideoProviderClient,
    private readonly model: string
  ) {}

  async diagnose(input: {
    asset: VideoClipAsset;
    match: MatchDetail;
    multimodalContext: MultimodalInputContext;
    deepReview?: DeepReviewResult;
    context?: VideoDiagnosisCallContext;
  }): Promise<NormalizedVideoDiagnosis> {
    const request = buildVideoDiagnosisProviderRequest({
      asset: input.asset,
      context: input.multimodalContext,
      match: input.match,
      deepReview: input.deepReview,
      model: this.model,
    });

    try {
      const raw = await this.client.diagnose(request, {
        'x-trace-id': input.context?.traceId ?? '',
        'x-client-request-id': input.context?.requestId ?? '',
      });
      return parseVideoProviderResponse(raw);
    } catch (error) {
      const mapped = mapProviderError(error);
      throw new Error(`${mapped.code}: ${mapped.message}`);
    }
  }
}
