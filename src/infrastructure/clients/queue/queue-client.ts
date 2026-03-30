import { getLocalJobQueueRuntime } from '../../queue/job-queue.runtime';
import { HttpClient } from '../http-client';

function resolveQueueMode(): 'http' | 'local' {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const raw = env.QUEUE_RUNTIME_MODE ?? env.APP_QUEUE_RUNTIME_MODE ?? 'http';
  return raw === 'local' ? 'local' : 'http';
}

export class QueueClient {
  constructor(private readonly http: HttpClient, private readonly queueName: string) {}

  async enqueue<T extends object>(jobType: string, payload: T): Promise<{ job_id: string; accepted: boolean }> {
    if (resolveQueueMode() === 'local') {
      return getLocalJobQueueRuntime().enqueue({
        queue_name: this.queueName,
        job_type: jobType,
        payload,
      });
    }

    return this.http.request({
      path: 'enqueue',
      method: 'POST',
      body: {
        queue_name: this.queueName,
        job_type: jobType,
        payload,
      },
    });
  }
}
