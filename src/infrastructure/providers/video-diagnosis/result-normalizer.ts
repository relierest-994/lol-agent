import type { VideoDiagnosisResult } from '../../../domain';
import type { NormalizedVideoDiagnosis } from './diagnosis.provider';

export class VideoDiagnosisResultNormalizer {
  normalize(input: {
    task_id: string;
    user_id: string;
    match_id: string;
    asset_id: string;
    raw: NormalizedVideoDiagnosis;
  }): Omit<VideoDiagnosisResult, 'result_id' | 'created_at'> {
    return {
      task_id: input.task_id,
      user_id: input.user_id,
      match_id: input.match_id,
      asset_id: input.asset_id,
      status: 'COMPLETED',
      diagnosis_summary: input.raw.diagnosis_summary,
      overall_judgement: input.raw.overall_judgement,
      likely_issue_types: input.raw.likely_issue_types,
      key_moments: input.raw.key_moments,
      positional_or_trade_error: input.raw.positional_or_trade_error,
      execution_or_decision_hints: input.raw.execution_or_decision_hints,
      next_action_advice: input.raw.next_action_advice,
      structured_findings: input.raw.structured_findings,
      confidence_hints: input.raw.confidence_hints,
      disclaimers: input.raw.disclaimers,
      recommended_next_questions: input.raw.recommended_next_questions,
      render_payload: input.raw.render_payload,
    };
  }
}
