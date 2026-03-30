import { createRealCapabilityProvider } from '../capabilities/toolkit/providers/real-capability.provider';
import { logger } from '../infrastructure/observability/logger';
import { getLocalJobQueueRuntime } from '../infrastructure/queue/job-queue.runtime';

interface VideoDiagnosisJobPayload {
  task_id: string;
  user_id: string;
  match_id: string;
  asset_id: string;
  asset_url?: string;
  question: string;
  now_iso: string;
}

export async function handleVideoDiagnosisJob(payload: VideoDiagnosisJobPayload): Promise<void> {
  const provider = createRealCapabilityProvider();
  if (!(provider instanceof Object) || !('runVideoDiagnosisFromQueueJob' in provider)) {
    throw new Error('Real capability provider does not implement queue job handler');
  }

  const runner = provider as unknown as {
    runVideoDiagnosisFromQueueJob: (input: VideoDiagnosisJobPayload) => Promise<void>;
  };

  await runner.runVideoDiagnosisFromQueueJob(payload);
}

export async function startVideoDiagnosisWorker(jobs: VideoDiagnosisJobPayload[]): Promise<void> {
  for (const job of jobs) {
    try {
      await handleVideoDiagnosisJob(job);
      logger.info('Video diagnosis queue job handled', {
        component: 'video-diagnosis-worker',
        task_id: job.task_id,
      });
    } catch (error) {
      logger.error('Video diagnosis queue job failed', {
        component: 'video-diagnosis-worker',
        task_id: job.task_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function registerVideoDiagnosisQueueHandler(): void {
  const runtime = getLocalJobQueueRuntime();
  runtime.registerHandler('video_diagnosis', async (payload) => {
    const typed = payload as unknown as VideoDiagnosisJobPayload;
    await handleVideoDiagnosisJob(typed);
  });
}
