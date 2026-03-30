import { describe, expect, it, vi } from 'vitest';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';
import { getLocalJobQueueRuntime } from '../src/infrastructure/queue/job-queue.runtime';

describe('LocalJobQueueRuntime', () => {
  it('retries failed jobs and eventually succeeds', async () => {
    vi.useFakeTimers();
    try {
      clearPersistentState('job-queue-runtime');
      const runtime = getLocalJobQueueRuntime();
      let attempts = 0;
      runtime.registerHandler('retry-once', async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('fail first');
      });

      const queued = await runtime.enqueue({
        queue_name: 'default',
        job_type: 'retry-once',
        payload: { ok: true },
        max_attempts: 3,
      });

      await runtime.processDueJobs();
      await vi.advanceTimersByTimeAsync(1200);
      await runtime.processDueJobs();
      const job = runtime.getJob(queued.job_id);
      expect(job?.status).toBe('SUCCEEDED');
      expect(job?.attempts).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves jobs to dead letter after max attempts', async () => {
    clearPersistentState('job-queue-runtime');
    const runtime = getLocalJobQueueRuntime();
    runtime.registerHandler('always-fail', async () => {
      throw new Error('always');
    });
    const queued = await runtime.enqueue({
      queue_name: 'default',
      job_type: 'always-fail',
      payload: { ok: false },
      max_attempts: 1,
    });
    await runtime.processDueJobs();
    const job = runtime.getJob(queued.job_id);
    expect(job?.status).toBe('DEAD_LETTER');
  });
});
