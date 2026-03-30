export type VideoAssetStatus = 'UPLOADING' | 'READY' | 'FAILED' | 'DELETED';
export type VideoDiagnosisTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type AssetProcessingJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface VideoClipAsset {
  asset_id: string;
  user_id: string;
  match_id: string;
  file_name: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  duration_seconds: number;
  storage_path: string;
  status: VideoAssetStatus;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
}

export interface MultimodalInputContext {
  context_id: string;
  user_id: string;
  match_id: string;
  asset_id: string;
  natural_language_question: string;
  basic_review_summary?: string;
  deep_review_summary?: string;
  created_at: string;
}

export interface AssetProcessingJob {
  job_id: string;
  asset_id: string;
  user_id: string;
  job_type: 'VALIDATE' | 'TRANSCODE' | 'THUMBNAIL' | 'FEATURE_EXTRACT';
  status: AssetProcessingJobStatus;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface VideoDiagnosisFinding {
  section_title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  insight: string;
  evidence: string[];
  advice: string;
  tags: string[];
  related_timestamp?: string;
}

export interface VideoDiagnosisResult {
  result_id: string;
  task_id: string;
  user_id: string;
  match_id: string;
  asset_id: string;
  status: 'COMPLETED';
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
  render_payload: {
    cards: VideoDiagnosisFinding[];
    summary: string;
    key_moments: Array<{
      timestamp: string;
      event: string;
      observation: string;
    }>;
    disclaimers: string[];
  };
  created_at: string;
}

export interface VideoDiagnosisTask {
  task_id: string;
  user_id: string;
  match_id: string;
  asset_id: string;
  natural_language_question: string;
  entitlement_context: {
    entitlement_checked: boolean;
    reason_code?: string;
  };
  status: VideoDiagnosisTaskStatus;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}
