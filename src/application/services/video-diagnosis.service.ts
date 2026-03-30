import type {
  DeepReviewResult,
  MatchDetail,
  VideoClipAsset,
  VideoDiagnosisResult,
  VideoDiagnosisTask,
} from '../../domain';
import { MockVideoDiagnosisRepository } from '../../infrastructure/repositories/mock-video-diagnosis.repository';
import { MockVideoDiagnosisProvider } from '../../infrastructure/providers/video-diagnosis/mock-video-diagnosis.provider';
import {
  DEFAULT_VIDEO_UPLOAD_CONSTRAINTS,
  VideoAssetPreprocessor,
  type VideoUploadInput,
} from '../../infrastructure/providers/video-diagnosis/video-asset.preprocessor';
import { MultimodalContextBuilder } from '../../infrastructure/providers/video-diagnosis/multimodal-context.builder';
import { VideoDiagnosisResultNormalizer } from '../../infrastructure/providers/video-diagnosis/result-normalizer';
import { getLocalJobQueueRuntime } from '../../infrastructure/queue/job-queue.runtime';
import {
  createVideoAssetStorageProvider,
  type VideoAssetStorageProvider,
} from '../../infrastructure/storage/video-asset-storage.provider';

export interface CreateVideoDiagnosisInput {
  user_id: string;
  match_id: string;
  asset_id: string;
  natural_language_question: string;
  entitlement_context: {
    entitlement_checked: boolean;
    reason_code?: string;
  };
  basic_review_summary?: string;
  deep_review_summary?: string;
  match: MatchDetail;
  deepReview?: DeepReviewResult;
  nowIso: string;
}

const repository = new MockVideoDiagnosisRepository();

export class VideoDiagnosisService {
  private readonly preprocessor = new VideoAssetPreprocessor(DEFAULT_VIDEO_UPLOAD_CONSTRAINTS);
  private readonly promptBuilder = new MultimodalContextBuilder();
  private readonly provider = new MockVideoDiagnosisProvider();
  private readonly normalizer = new VideoDiagnosisResultNormalizer();
  private readonly storageProvider: VideoAssetStorageProvider;

  constructor(storageProvider: VideoAssetStorageProvider = createVideoAssetStorageProvider()) {
    this.storageProvider = storageProvider;
    getLocalJobQueueRuntime().registerHandler('asset_processing', async (payload) => {
      const typed = payload as {
        job_id: string;
        valid: boolean;
        error?: string;
      };
      repository.updateJobStatus(typed.job_id, 'RUNNING', new Date().toISOString());
      if (!typed.valid) {
        repository.updateJobStatus(typed.job_id, 'FAILED', new Date().toISOString(), typed.error);
        return;
      }
      repository.updateJobStatus(typed.job_id, 'COMPLETED', new Date().toISOString());
    });
  }

  async uploadVideoClip(
    input: VideoUploadInput & {
      storage_path?: string;
      nowIso: string;
    }
  ): Promise<
    | { ok: true; asset: VideoClipAsset; warnings: string[] }
    | { ok: false; error: string }
  > {
    const validation = this.preprocessor.validate(input);
    const extension = input.file_name.split('.').pop()?.toLowerCase() ?? '';
    let reserved:
      | {
          storage_path: string;
          object_key: string;
          upload_url?: string;
        }
      | undefined;
    try {
      reserved = await this.storageProvider.reserveUpload({
        user_id: input.user_id,
        match_id: input.match_id,
        file_name: input.file_name,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to reserve storage path' };
    }

    let asset: VideoClipAsset;
    try {
      asset = repository.createAsset(
        {
          user_id: input.user_id,
          match_id: input.match_id,
          file_name: input.file_name,
          mime_type: input.mime_type,
          extension,
          size_bytes: input.size_bytes,
          duration_seconds: input.duration_seconds,
          storage_path: input.storage_path ?? reserved.storage_path,
          status: validation.valid ? 'UPLOADING' : 'FAILED',
          failure_reason: validation.error,
        },
        input.nowIso
      );
    } catch (error) {
      await this.storageProvider.rollbackUpload({
        object_key: reserved.object_key,
        storage_path: reserved.storage_path,
      });
      return { ok: false, error: error instanceof Error ? error.message : 'Asset metadata persistence failed' };
    }

    const validateJob = repository.createProcessingJob(
      {
        asset_id: asset.asset_id,
        user_id: input.user_id,
        job_type: 'VALIDATE',
      },
      input.nowIso
    );
    await getLocalJobQueueRuntime().enqueue({
      queue_name: 'asset_processing',
      job_type: 'asset_processing',
      payload: {
        job_id: validateJob.job_id,
        valid: validation.valid,
        error: validation.error,
      },
    });

    if (!validation.valid) {
      repository.updateAssetStatus(asset.asset_id, 'FAILED', input.nowIso, validation.error);
      await this.storageProvider.rollbackUpload({
        object_key: reserved.object_key,
        storage_path: reserved.storage_path,
      });
      return { ok: false, error: validation.error ?? 'Invalid upload' };
    }

    const saved = repository.updateAssetStatus(asset.asset_id, 'READY', input.nowIso);
    if (!saved) return { ok: false, error: 'Asset persistence failed' };
    saved.storage_path = this.preprocessor.buildStoragePath(saved);
    saved.updated_at = input.nowIso;
    try {
      await this.storageProvider.commitUpload({
        object_key: reserved.object_key,
        storage_path: saved.storage_path,
        nowIso: input.nowIso,
      });
    } catch (error) {
      repository.updateAssetStatus(asset.asset_id, 'FAILED', input.nowIso, 'storage_commit_failed');
      await this.storageProvider.rollbackUpload({
        object_key: reserved.object_key,
        storage_path: saved.storage_path,
      });
      return { ok: false, error: error instanceof Error ? error.message : 'Storage commit failed' };
    }
    return { ok: true, asset: saved, warnings: validation.warnings };
  }

  getAsset(assetId: string): VideoClipAsset | undefined {
    return repository.getAsset(assetId);
  }

  async createDiagnosis(input: CreateVideoDiagnosisInput): Promise<
    | { ok: true; task: VideoDiagnosisTask }
    | { ok: false; error: string }
  > {
    const asset = repository.getAsset(input.asset_id);
    if (!asset) return { ok: false, error: 'asset not found' };
    if (asset.user_id !== input.user_id) return { ok: false, error: 'asset ownership mismatch' };
    if (asset.match_id !== input.match_id) return { ok: false, error: 'asset not bound to match_id' };
    if (asset.status !== 'READY') return { ok: false, error: `asset status must be READY, got ${asset.status}` };
    if (!input.natural_language_question.trim()) return { ok: false, error: 'natural_language_question is required' };

    const task = repository.createDiagnosisTask(
      {
        user_id: input.user_id,
        match_id: input.match_id,
        asset_id: input.asset_id,
        natural_language_question: input.natural_language_question,
        entitlement_context: input.entitlement_context,
        status: 'PENDING',
      },
      input.nowIso
    );
    return { ok: true, task };
  }

  async runDiagnosis(taskId: string, input: {
    nowIso: string;
    match: MatchDetail;
    basic_review_summary?: string;
    deepReview?: DeepReviewResult;
  }): Promise<void> {
    const task = repository.getDiagnosisTask(taskId);
    if (!task) return;
    repository.updateDiagnosisTaskStatus(task.task_id, 'RUNNING', input.nowIso);
    const asset = repository.getAsset(task.asset_id);
    if (!asset) {
      repository.updateDiagnosisTaskStatus(task.task_id, 'FAILED', input.nowIso, 'asset missing');
      return;
    }

    try {
      const context = repository.upsertContext(
        this.promptBuilder.build({
          user_id: task.user_id,
          match_id: task.match_id,
          asset,
          question: task.natural_language_question,
          basicReview: undefined,
          deepReview: input.deepReview,
          match: input.match,
          nowIso: input.nowIso,
        }),
        input.nowIso
      );

      const raw = await this.provider.diagnose({
        asset,
        match: input.match,
        multimodalContext: context,
      });

      const normalized = this.normalizer.normalize({
        task_id: task.task_id,
        user_id: task.user_id,
        match_id: task.match_id,
        asset_id: task.asset_id,
        raw,
      });

      repository.saveDiagnosisResult(normalized, input.nowIso);
      repository.updateDiagnosisTaskStatus(task.task_id, 'COMPLETED', input.nowIso);
    } catch (error) {
      repository.updateDiagnosisTaskStatus(
        task.task_id,
        'FAILED',
        input.nowIso,
        error instanceof Error ? error.message : 'diagnosis failed'
      );
    }
  }

  getDiagnosisTask(taskId: string): VideoDiagnosisTask | undefined {
    return repository.getDiagnosisTask(taskId);
  }

  getLatestDiagnosisTask(userId: string, matchId: string): VideoDiagnosisTask | undefined {
    return repository.getLatestDiagnosisTask(userId, matchId);
  }

  getDiagnosisResultByTask(taskId: string): VideoDiagnosisResult | undefined {
    const task = repository.getDiagnosisTask(taskId);
    if (!task) return undefined;
    const latest = repository.getLatestDiagnosisResult(task.user_id, task.match_id);
    if (!latest || latest.task_id !== taskId) return undefined;
    return latest;
  }

  getLatestDiagnosisResult(userId: string, matchId: string): VideoDiagnosisResult | undefined {
    return repository.getLatestDiagnosisResult(userId, matchId);
  }
}

export const videoDiagnosisService = new VideoDiagnosisService();
