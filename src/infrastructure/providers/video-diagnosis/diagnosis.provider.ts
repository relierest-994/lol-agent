import type {
  MatchDetail,
  MultimodalInputContext,
  VideoClipAsset,
  VideoDiagnosisFinding,
  VideoDiagnosisResult,
} from '../../../domain';

export interface NormalizedVideoDiagnosis {
  diagnosis_summary: string;
  overall_judgement: string;
  likely_issue_types: string[];
  key_moments: Array<{
    timestamp: string;
    event: string;
    observation: string;
  }>;
  positional_or_trade_error: string;
  execution_or_decision_hints: string[];
  next_action_advice: string[];
  structured_findings: VideoDiagnosisFinding[];
  confidence_hints: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    reason: string;
  };
  disclaimers: string[];
  recommended_next_questions: string[];
  render_payload: VideoDiagnosisResult['render_payload'];
}

export interface VideoDiagnosisProvider {
  diagnose(input: {
    asset: VideoClipAsset;
    match: MatchDetail;
    multimodalContext: MultimodalInputContext;
  }): Promise<NormalizedVideoDiagnosis>;
}
