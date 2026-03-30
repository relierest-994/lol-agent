import type {
  AssetProcessingJob,
  AssetProcessingJobStatus,
  MultimodalInputContext,
  VideoClipAsset,
  VideoDiagnosisResult,
  VideoDiagnosisTask,
  VideoDiagnosisTaskStatus,
} from '../../domain';
import { createPersistentStateStore, type PersistentStateStore } from '../persistence/persistent-state.store';

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function key(userId: string, matchId: string): string {
  return `${userId}:${matchId}`;
}

export class MockVideoDiagnosisRepository {
  private readonly assets = new Map<string, VideoClipAsset>();
  private readonly tasks = new Map<string, VideoDiagnosisTask>();
  private readonly results = new Map<string, VideoDiagnosisResult>();
  private readonly latestTaskByUserMatch = new Map<string, string>();
  private readonly latestResultByUserMatch = new Map<string, string>();
  private readonly contexts = new Map<string, MultimodalInputContext>();
  private readonly jobsByAsset = new Map<string, AssetProcessingJob[]>();
  private readonly store: PersistentStateStore;

  constructor(store: PersistentStateStore = createPersistentStateStore('video-diagnosis-repository')) {
    this.store = store;
    this.hydrate();
  }

  createAsset(input: Omit<VideoClipAsset, 'asset_id' | 'created_at' | 'updated_at'>, nowIso: string): VideoClipAsset {
    const asset: VideoClipAsset = {
      ...input,
      asset_id: randomId('asset'),
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.assets.set(asset.asset_id, asset);
    this.persist();
    return asset;
  }

  getAsset(assetId: string): VideoClipAsset | undefined {
    return this.assets.get(assetId);
  }

  updateAssetStatus(assetId: string, status: VideoClipAsset['status'], nowIso: string, reason?: string): VideoClipAsset | undefined {
    const asset = this.assets.get(assetId);
    if (!asset) return undefined;
    asset.status = status;
    asset.updated_at = nowIso;
    if (reason) asset.failure_reason = reason;
    this.persist();
    return asset;
  }

  createProcessingJob(
    input: Omit<AssetProcessingJob, 'job_id' | 'created_at' | 'updated_at' | 'status'>,
    nowIso: string
  ): AssetProcessingJob {
    const job: AssetProcessingJob = {
      ...input,
      job_id: randomId('job'),
      status: 'PENDING',
      created_at: nowIso,
      updated_at: nowIso,
    };
    const list = this.jobsByAsset.get(job.asset_id) ?? [];
    list.push(job);
    this.jobsByAsset.set(job.asset_id, list);
    this.persist();
    return job;
  }

  updateJobStatus(jobId: string, status: AssetProcessingJobStatus, nowIso: string, error?: string): AssetProcessingJob | undefined {
    for (const jobs of this.jobsByAsset.values()) {
      const job = jobs.find((item) => item.job_id === jobId);
      if (!job) continue;
      job.status = status;
      job.updated_at = nowIso;
      if (error) job.error_message = error;
      this.persist();
      return job;
    }
    return undefined;
  }

  listJobs(assetId: string): AssetProcessingJob[] {
    return [...(this.jobsByAsset.get(assetId) ?? [])];
  }

  upsertContext(input: Omit<MultimodalInputContext, 'context_id' | 'created_at'>, nowIso: string): MultimodalInputContext {
    const mapKey = key(input.user_id, input.match_id);
    const existing = this.contexts.get(mapKey);
    if (existing) {
      existing.asset_id = input.asset_id;
      existing.natural_language_question = input.natural_language_question;
      existing.basic_review_summary = input.basic_review_summary;
      existing.deep_review_summary = input.deep_review_summary;
      return existing;
    }
    const created: MultimodalInputContext = {
      ...input,
      context_id: randomId('mmctx'),
      created_at: nowIso,
    };
    this.contexts.set(mapKey, created);
    this.persist();
    return created;
  }

  createDiagnosisTask(input: Omit<VideoDiagnosisTask, 'task_id' | 'created_at' | 'updated_at'>, nowIso: string): VideoDiagnosisTask {
    const task: VideoDiagnosisTask = {
      ...input,
      task_id: randomId('vdtask'),
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.tasks.set(task.task_id, task);
    this.latestTaskByUserMatch.set(key(task.user_id, task.match_id), task.task_id);
    this.persist();
    return task;
  }

  updateDiagnosisTaskStatus(
    taskId: string,
    status: VideoDiagnosisTaskStatus,
    nowIso: string,
    errorMessage?: string
  ): VideoDiagnosisTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    task.status = status;
    task.updated_at = nowIso;
    if (status === 'RUNNING') task.started_at = nowIso;
    if (status === 'COMPLETED' || status === 'FAILED') task.completed_at = nowIso;
    if (errorMessage) task.error_message = errorMessage;
    this.persist();
    return task;
  }

  getDiagnosisTask(taskId: string): VideoDiagnosisTask | undefined {
    return this.tasks.get(taskId);
  }

  getLatestDiagnosisTask(userId: string, matchId: string): VideoDiagnosisTask | undefined {
    const taskId = this.latestTaskByUserMatch.get(key(userId, matchId));
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  saveDiagnosisResult(result: Omit<VideoDiagnosisResult, 'result_id' | 'created_at'>, nowIso: string): VideoDiagnosisResult {
    const created: VideoDiagnosisResult = {
      ...result,
      result_id: randomId('vdres'),
      created_at: nowIso,
    };
    this.results.set(created.result_id, created);
    this.latestResultByUserMatch.set(key(created.user_id, created.match_id), created.result_id);
    this.persist();
    return created;
  }

  getDiagnosisResult(resultId: string): VideoDiagnosisResult | undefined {
    return this.results.get(resultId);
  }

  getLatestDiagnosisResult(userId: string, matchId: string): VideoDiagnosisResult | undefined {
    const resultId = this.latestResultByUserMatch.get(key(userId, matchId));
    return resultId ? this.results.get(resultId) : undefined;
  }

  private hydrate(): void {
    const state = this.store.read<{
      assets: Array<[string, VideoClipAsset]>;
      tasks: Array<[string, VideoDiagnosisTask]>;
      results: Array<[string, VideoDiagnosisResult]>;
      latestTaskByUserMatch: Array<[string, string]>;
      latestResultByUserMatch: Array<[string, string]>;
      contexts: Array<[string, MultimodalInputContext]>;
      jobsByAsset: Array<[string, AssetProcessingJob[]]>;
    }>('state');
    if (!state) return;
    this.assets.clear();
    this.tasks.clear();
    this.results.clear();
    this.latestTaskByUserMatch.clear();
    this.latestResultByUserMatch.clear();
    this.contexts.clear();
    this.jobsByAsset.clear();
    for (const [k, v] of state.assets) this.assets.set(k, v);
    for (const [k, v] of state.tasks) this.tasks.set(k, v);
    for (const [k, v] of state.results) this.results.set(k, v);
    for (const [k, v] of state.latestTaskByUserMatch) this.latestTaskByUserMatch.set(k, v);
    for (const [k, v] of state.latestResultByUserMatch) this.latestResultByUserMatch.set(k, v);
    for (const [k, v] of state.contexts) this.contexts.set(k, v);
    for (const [k, v] of state.jobsByAsset) this.jobsByAsset.set(k, v);
  }

  private persist(): void {
    this.store.write('state', {
      assets: [...this.assets.entries()],
      tasks: [...this.tasks.entries()],
      results: [...this.results.entries()],
      latestTaskByUserMatch: [...this.latestTaskByUserMatch.entries()],
      latestResultByUserMatch: [...this.latestResultByUserMatch.entries()],
      contexts: [...this.contexts.entries()],
      jobsByAsset: [...this.jobsByAsset.entries()],
    });
  }
}
