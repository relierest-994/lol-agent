export interface ReviewSection {
  title: string;
  lines: string[];
}

export type ReviewTagType = 'issue' | 'highlight';

export type ReviewTagCode =
  | 'laning_weak'
  | 'low_objective_presence'
  | 'low_vision_control'
  | 'overextend_midgame'
  | 'low_economy_conversion'
  | 'stable_laning'
  | 'strong_teamfight_presence'
  | 'high_objective_presence'
  | 'good_roaming_impact'
  | 'high_damage_pressure';

export interface ReviewTag {
  type: ReviewTagType;
  code: ReviewTagCode;
  weight: number;
  reason: string;
}

export interface BasicReviewSignals {
  laningScore: number;
  resourceScore: number;
  deathValueScore: number;
  teamfightScore: number;
  economyScore: number;
}

export interface BasicReviewDiagnostics {
  signals: BasicReviewSignals;
  issueTags: ReviewTag[];
  highlightTags: ReviewTag[];
  suggestionTags: ReviewTagCode[];
}

export interface BasicReviewReport {
  matchId: string;
  generatedAt: string;
  sections: [
    ReviewSection,
    ReviewSection,
    ReviewSection,
    ReviewSection,
    ReviewSection
  ];
  diagnostics: BasicReviewDiagnostics;
}

export type DeepReviewDimension =
  | 'LANING'
  | 'MIDGAME_TEMPO'
  | 'RESOURCE_CONTROL'
  | 'TEAMFIGHT'
  | 'BUILD_SKILL_PATH'
  | 'ROLE_SPECIFIC';

export type DeepReviewTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ReviewEvidence {
  evidence_id: string;
  source_type: 'MATCH_TIMELINE' | 'MATCH_SIGNAL' | 'BASIC_REVIEW';
  description: string;
  related_timestamp?: string;
  confidence: number;
}

export interface ReviewSuggestion {
  suggestion_id: string;
  advice: string;
  tags: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ReviewInsight {
  insight_id: string;
  section_title: string;
  dimension: DeepReviewDimension;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  insight: string;
  evidence: ReviewEvidence[];
  advice: string;
  tags: string[];
  related_timestamp?: string;
}

export interface MatchAnalysisContext {
  context_id: string;
  user_id: string;
  match_id: string;
  region: 'INTERNATIONAL' | 'CN';
  basic_review_generated_at?: string;
  deep_review_generated_at?: string;
  latest_question_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeepReviewTask {
  task_id: string;
  user_id: string;
  match_id: string;
  status: DeepReviewTaskStatus;
  focus_dimensions: DeepReviewDimension[];
  authorization_context: {
    entitlement_checked: boolean;
    reason_code?: string;
  };
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface DeepReviewResult {
  result_id: string;
  task_id: string;
  user_id: string;
  match_id: string;
  status: 'COMPLETED';
  dimensions: DeepReviewDimension[];
  structured_insights: ReviewInsight[];
  evidence_list: ReviewEvidence[];
  suggestion_list: ReviewSuggestion[];
  render_payload: {
    sections: Array<{
      section_title: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      insight: string;
      evidence: string[];
      advice: string;
      tags: string[];
      related_timestamp?: string;
    }>;
    summary: string;
  };
  generated_at: string;
  cached: boolean;
}

export interface MatchConversationSession {
  conversation_id: string;
  user_id: string;
  match_id: string;
  created_at: string;
  updated_at: string;
}

export interface MatchConversationMessage {
  message_id: string;
  conversation_id: string;
  user_id: string;
  match_id: string;
  role: 'USER' | 'AGENT';
  content: string;
  ref: Array<'BASIC_REVIEW' | 'DEEP_REVIEW'>;
  created_at: string;
}

export interface MatchAskAnswer {
  status: 'ANSWERED' | 'NEEDS_DEEP_REVIEW' | 'PAYWALL_REQUIRED';
  answer?: {
    summary: string;
    sections: Array<{
      section_title: string;
      insight: string;
      evidence: string[];
      advice: string;
      tags: string[];
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  cited_from: {
    basic_review: boolean;
    deep_review: boolean;
  };
  paywall_action?: {
    feature_code: 'DEEP_REVIEW' | 'AI_FOLLOWUP';
    reason_code: string;
    display_message: string;
    paywall_payload?: import('../entitlement/types').PaywallPayload;
  };
  suggested_prompts: string[];
}
