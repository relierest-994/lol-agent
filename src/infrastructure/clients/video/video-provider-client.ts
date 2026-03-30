import { HttpClient } from '../http-client';

export class VideoProviderClient {
  constructor(private readonly http: HttpClient, private readonly apiKey?: string) {}

  async diagnose(
    input: {
      model: string;
    asset_url: string;
    question: string;
    match_context: Record<string, unknown>;
    deep_review_context?: Record<string, unknown>;
      multimodal_context?: Record<string, unknown>;
    },
    extraHeaders?: Record<string, string>
  ): Promise<{
    diagnosis_summary: string;
    overall_judgement: string;
    likely_issue_types: string[];
    key_moments: Array<{ timestamp: string; event: string; observation: string }>;
    structured_findings: import('../../../domain').VideoDiagnosisFinding[];
    confidence_hints: import('../../../domain').VideoDiagnosisResult['confidence_hints'];
    recommended_next_questions: string[];
    disclaimers: string[];
  }> {
    return this.http.request({
      path: 'diagnose',
      method: 'POST',
      headers: {
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(extraHeaders ?? {}),
      },
      body: input,
    });
  }
}
