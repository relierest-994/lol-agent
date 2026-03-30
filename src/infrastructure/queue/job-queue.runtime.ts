import { createPersistentStateStore } from '../persistence/persistent-state.store';
import { logger } from '../observability/logger';

export type QueueJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER';

export interface QueueJobRecord<TPayload extends object = Record<string, unknown>> {
  job_id: string;
  queue_name: string;
  job_type: string;
  payload: TPayload;
  status: QueueJobStatus;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  created_at: string;
  updated_at: string;
  last_error?: string;
}

export type QueueJobHandler<TPayload extends object = Record<string, unknown>> = (
  payload: TPayload,
  meta: { jobId: string; attempt: number }
) => Promise<void>;

interface QueueRuntimeState {
  jobs: QueueJobRecord[];
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * Math.max(1, attempt));
}

function isQueueJobRecord(input: unknown): input is QueueJobRecord {
  if (!input || typeof input !== 'object') return false;
  const job = input as Partial<QueueJobRecord>;
  return (
    typeof job.job_id === 'string' &&
    typeof job.queue_name === 'string' &&
    typeof job.job_type === 'string' &&
    typeof job.status === 'string' &&
    typeof job.attempts === 'number' &&
    typeof job.max_attempts === 'number' &&
    typeof job.next_run_at === 'string' &&
    typeof job.created_at === 'string' &&
    typeof job.updated_at === 'string'
  );
}

function normalizeJobs(input: unknown): QueueJobRecord[] {
  if (Array.isArray(input)) {
    return input.filter(isQueueJobRecord);
  }

  // Backward compatibility: some historical states may store jobs as object-map.
  if (input && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).filter(isQueueJobRecord);
  }

  return [];
}

class LocalJobQueueRuntime {
  private readonly store = createPersistentStateStore('job-queue-runtime');
  private readonly handlers = new Map<string, QueueJobHandler>();
  private readonly jobs = new Map<string, QueueJobRecord>();
  private processing = false;
  private rerunRequested = false;

  constructor() {
    this.hydrate();
  }

  registerHandler(jobType: string, handler: QueueJobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async enqueue<TPayload extends object>(input: {
    queue_name: string;
    job_type: string;
    payload: TPayload;
    max_attempts?: number;
  }): Promise<{ job_id: string; accepted: boolean }> {
    const createdAt = nowIso();
    const record: QueueJobRecord<TPayload> = {
      job_id: randomId('job'),
      queue_name: input.queue_name,
      job_type: input.job_type,
      payload: input.payload,
      status: 'PENDING',
      attempts: 0,
      max_attempts: Math.max(1, input.max_attempts ?? 3),
      next_run_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    };
    this.jobs.set(record.job_id, record as QueueJobRecord);
    this.persist();
    if (this.processing) {
      this.rerunRequested = true;
    } else {
      void this.processDueJobs();
    }
    return { job_id: record.job_id, accepted: true };
  }

  getJob(jobId: string): QueueJobRecord | undefined {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : undefined;
  }

  listJobsByType(jobType: string): QueueJobRecord[] {
    return [...this.jobs.values()].filter((item) => item.job_type === jobType).map((item) => ({ ...item }));
  }

  async processDueJobs(): Promise<void> {
    if (this.processing) {
      this.rerunRequested = true;
      return;
    }
    this.processing = true;
    try {
      do {
        this.rerunRequested = false;
        const now = Date.now();
        const dueJobs = [...this.jobs.values()]
          .filter((item) => (item.status === 'PENDING' || item.status === 'FAILED') && new Date(item.next_run_at).getTime() <= now)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const job of dueJobs) {
          const handler = this.handlers.get(job.job_type);
          if (!handler) {
            job.status = 'DEAD_LETTER';
            job.last_error = `No handler for job type: ${job.job_type}`;
            job.updated_at = nowIso();
            this.persist();
            continue;
          }

          job.status = 'RUNNING';
          job.attempts += 1;
          job.updated_at = nowIso();
          this.persist();

          try {
            await handler(job.payload, { jobId: job.job_id, attempt: job.attempts });
            job.status = 'SUCCEEDED';
            job.updated_at = nowIso();
            this.persist();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            job.last_error = message;
            job.updated_at = nowIso();
            if (job.attempts >= job.max_attempts) {
              job.status = 'DEAD_LETTER';
              logger.error('Queue job moved to dead letter', {
                component: 'local-job-queue',
                job_id: job.job_id,
                job_type: job.job_type,
                attempts: job.attempts,
              });
            } else {
              job.status = 'FAILED';
              job.next_run_at = new Date(Date.now() + backoffMs(job.attempts)).toISOString();
            }
            this.persist();
          }
        }
      } while (this.rerunRequested);
    } finally {
      this.processing = false;
    }
  }

  private hydrate(): void {
    const state = this.store.read<QueueRuntimeState | { jobs?: unknown }>('state');
    if (!state) return;
    this.jobs.clear();
    const jobs = normalizeJobs(state.jobs);
    for (const job of jobs) this.jobs.set(job.job_id, job);
    if (jobs.length === 0 && state.jobs !== undefined) {
      logger.warn('Queue runtime state was invalid, reset to empty state', {
        component: 'local-job-queue',
      });
      this.persist();
    }
  }

  private persist(): void {
    this.store.write('state', {
      jobs: [...this.jobs.values()],
    } satisfies QueueRuntimeState);
  }
}

const singleton = new LocalJobQueueRuntime();

export function getLocalJobQueueRuntime(): LocalJobQueueRuntime {
  return singleton;
}
