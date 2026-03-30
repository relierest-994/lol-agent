import { STANDARD_ERROR_SCHEMA, entitlementRequired, invalidInput, notFound, providerError, unauthorized } from '../errors';
import { defaultRateLimiter } from '../../../infrastructure/security/rate-limiter';
import type { CapabilityDefinition } from '../types';

const allowedMimeEnum = ['video/mp4', 'video/quicktime', 'video/webm'];

export const assetVideoUploadCapability: CapabilityDefinition<
  {
    user_id: string;
    match_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
  },
  {
    status: 'READY';
    asset_id: string;
    storage_path: string;
    warnings: string[];
    constraints: {
      max_duration_seconds: number;
      recommended_duration_seconds: [number, number];
      max_size_bytes: number;
      allowed_mime_types: string[];
      single_clip_only: true;
    };
  }
> = {
  id: 'asset.video.upload',
  title: 'Upload one short video clip asset',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'match_id', 'file_name', 'mime_type', 'size_bytes', 'duration_seconds'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      match_id: { type: 'string', description: 'Bound match id' },
      file_name: { type: 'string', description: 'Client file name with extension' },
      mime_type: { type: 'string', description: 'Mime type', enum: allowedMimeEnum },
      size_bytes: { type: 'number', description: 'File size in bytes' },
      duration_seconds: { type: 'number', description: 'Clip duration seconds (<=60)' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status', 'asset_id', 'storage_path', 'warnings', 'constraints'],
    properties: {
      status: { type: 'string', description: 'Asset status' },
      asset_id: { type: 'string', description: 'Asset id' },
      storage_path: { type: 'string', description: 'Stored path' },
      warnings: { type: 'array', description: 'Validation warnings' },
      constraints: { type: 'object', description: 'Current upload constraints' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Upload is precondition, not paid itself',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.user_id) return unauthorized('user_id does not match authenticated context');
    const rate = defaultRateLimiter.consume({
      key: `upload:${context.userId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return invalidInput('Upload rate limit exceeded', `retry_after_ms=${rate.reset_after_ms}`);
    }
    if (!input.user_id || !input.match_id) return invalidInput('user_id and match_id are required');
    try {
      const uploaded = await provider.uploadVideoAsset({
        ...input,
        nowIso: context.nowIso,
      });
      if (!uploaded.ok) return invalidInput(uploaded.error);
      return {
        ok: true,
        data: {
          status: 'READY',
          asset_id: uploaded.asset.asset_id,
          storage_path: uploaded.asset.storage_path,
          warnings: uploaded.warnings,
          constraints: {
            max_duration_seconds: 60,
            recommended_duration_seconds: [10, 30],
            max_size_bytes: 50 * 1024 * 1024,
            allowed_mime_types: [...allowedMimeEnum],
            single_clip_only: true,
          },
        },
      };
    } catch (error) {
      return providerError('Failed to upload video asset', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const diagnosisVideoCreateCapability: CapabilityDefinition<
  {
    user_id: string;
    region: 'INTERNATIONAL' | 'CN';
    match_id: string;
    asset_id: string;
    natural_language_question: string;
    entitlement_context: {
      entitlement_checked: boolean;
      reason_code?: string;
    };
  },
  {
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    task_id: string;
    message: string;
  }
> = {
  id: 'diagnosis.video.create',
  title: 'Create asynchronous video diagnosis task',
  inputSchema: {
    type: 'object',
    required: ['user_id', 'region', 'match_id', 'asset_id', 'natural_language_question', 'entitlement_context'],
    properties: {
      user_id: { type: 'string', description: 'User id' },
      region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
      match_id: { type: 'string', description: 'Bound match id' },
      asset_id: { type: 'string', description: 'Uploaded asset id' },
      natural_language_question: { type: 'string', description: 'Question around clip and match context' },
      entitlement_context: { type: 'object', description: 'Authorization context' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status', 'task_id', 'message'],
    properties: {
      status: { type: 'string', description: 'Task status' },
      task_id: { type: 'string', description: 'Task id' },
      message: { type: 'string', description: 'Task creation summary' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: true,
    feature: 'CLIP_REVIEW',
    description: 'Video diagnosis is paid',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.user_id) return unauthorized('user_id does not match authenticated context');
    const rate = defaultRateLimiter.consume({
      key: `diagnosis:${context.userId}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return invalidInput('Diagnosis trigger rate limit exceeded', `retry_after_ms=${rate.reset_after_ms}`);
    }
    if (!input.natural_language_question.trim()) {
      return invalidInput('natural_language_question is required');
    }
    try {
      const entitlement = await provider.checkFeatureAccess(input.user_id, 'CLIP_REVIEW', context.nowIso);
      if (!entitlement.can_access) {
        return entitlementRequired(entitlement.display_message, entitlement.reason_code);
      }

      const match = await provider.getMatchDetail(input.region, input.match_id);
      if (!match) return notFound(`Match not found: ${input.match_id}`);

      const deep = await provider.getDeepReviewResult({
        userId: input.user_id,
        matchId: input.match_id,
        nowIso: context.nowIso,
      });

      const created = await provider.createVideoDiagnosisTask({
        user_id: input.user_id,
        match_id: input.match_id,
        asset_id: input.asset_id,
        natural_language_question: input.natural_language_question,
        entitlement_context: input.entitlement_context,
        match,
        deepReview: deep,
        nowIso: context.nowIso,
      });
      if (!created.ok) return invalidInput(created.error);
      return {
        ok: true,
        data: {
          status: created.task.status,
          task_id: created.task.task_id,
          message:
            'Video diagnosis task enqueued. This is assistive diagnosis, not absolute frame-by-frame judgement.',
        },
      };
    } catch (error) {
      return providerError('Failed to create video diagnosis task', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const diagnosisVideoStatusCapability: CapabilityDefinition<
  { task_id: string },
  { status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; error_message?: string }
> = {
  id: 'diagnosis.video.status',
  title: 'Get video diagnosis task status',
  inputSchema: {
    type: 'object',
    required: ['task_id'],
    properties: {
      task_id: { type: 'string', description: 'Diagnosis task id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', description: 'Task status' },
      error_message: { type: 'string', description: 'Failure reason when status is FAILED' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Task status polling',
  },
  async invoke(_context, input, provider) {
    try {
      const task = await provider.getVideoDiagnosisTask(input.task_id);
      if (!task) return notFound(`Diagnosis task not found: ${input.task_id}`);
      return {
        ok: true,
        data: {
          status: task.status,
          error_message: task.error_message,
        },
      };
    } catch (error) {
      return providerError('Failed to query diagnosis status', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export const diagnosisVideoGetCapability: CapabilityDefinition<
  { task_id: string },
  {
    status: 'COMPLETED';
    diagnosis_summary: string;
    structured_findings: import('../../../domain').VideoDiagnosisFinding[];
    confidence_hints: import('../../../domain').VideoDiagnosisResult['confidence_hints'];
    recommended_next_questions: string[];
    render_payload: import('../../../domain').VideoDiagnosisResult['render_payload'];
    disclaimers: string[];
  }
> = {
  id: 'diagnosis.video.get',
  title: 'Get video diagnosis result',
  inputSchema: {
    type: 'object',
    required: ['task_id'],
    properties: {
      task_id: { type: 'string', description: 'Diagnosis task id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: [
      'status',
      'diagnosis_summary',
      'structured_findings',
      'confidence_hints',
      'recommended_next_questions',
      'render_payload',
      'disclaimers',
    ],
    properties: {
      status: { type: 'string', description: 'Result status' },
      diagnosis_summary: { type: 'string', description: 'Summary for this clip diagnosis' },
      structured_findings: { type: 'array', description: 'Structured findings' },
      confidence_hints: { type: 'object', description: 'Confidence hint' },
      recommended_next_questions: { type: 'array', description: 'Recommended follow-up questions' },
      render_payload: { type: 'object', description: 'UI render payload' },
      disclaimers: { type: 'array', description: 'Explicit non-absolute diagnosis disclaimers' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Result retrieval',
  },
  async invoke(_context, input, provider) {
    try {
      const result = await provider.getVideoDiagnosisResultByTask(input.task_id);
      if (!result) return notFound(`Diagnosis result not found for task: ${input.task_id}`);
      return {
        ok: true,
        data: {
          status: 'COMPLETED',
          diagnosis_summary: result.diagnosis_summary,
          structured_findings: result.structured_findings,
          confidence_hints: result.confidence_hints,
          recommended_next_questions: result.recommended_next_questions,
          render_payload: result.render_payload,
          disclaimers: result.disclaimers,
        },
      };
    } catch (error) {
      return providerError('Failed to get diagnosis result', error instanceof Error ? error.message : 'Unknown');
    }
  },
};
