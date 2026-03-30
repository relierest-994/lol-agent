import type { CapabilityProvider } from '../src/capabilities/toolkit';
import { loadEnvFiles } from './config/load-env-files';
import { loadBackendRuntimeMode } from './config/backend-runtime-mode';
import { getDbHealth, type DbHealthStatus } from './db/db-readiness';
import { insertAgentTaskRun } from './db/psql-client';
import { installDbBackedLocalStorage } from './db/node-local-storage-db';

export interface BackendAppContext {
  orchestrator: {
    run: (input: {
      userId: string;
      region: 'INTERNATIONAL' | 'CN';
      userInput: string;
      linkedAccount?: unknown;
      uploadedClip?: unknown;
    }) => Promise<unknown>;
  };
  provider: CapabilityProvider;
  paymentWebhookService: {
    createCheckout: (input: {
      user_id: string;
      order_id: string;
      amount_cents: number;
      currency: 'CNY' | 'USD';
      plan_code: string;
      feature_code?: unknown;
      return_url: string;
    }) => Promise<unknown>;
    handleCallback: (input: {
      provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
      event_id: string;
      order_id: string;
      transaction_id: string;
      status: 'SUCCEEDED' | 'FAILED';
      amount_cents: number;
      currency: string;
      timestamp: string;
      signature: string;
      raw_payload: Record<string, unknown>;
      nowIso: string;
    }) => Promise<unknown>;
  };
  runQueueTick: () => Promise<void>;
  runtimeMode: 'mock' | 'db';
  dbHealth: () => DbHealthStatus;
  recordTaskRun: (input: {
    userId: string;
    sessionId: string;
    intent: string;
    status: string;
    payload: unknown;
    errorCode?: string;
  }) => void;
}

export async function createBackendAppContext(): Promise<BackendAppContext> {
  loadEnvFiles();
  const runtimeMode = loadBackendRuntimeMode();
  if (runtimeMode === 'db') {
    installDbBackedLocalStorage();
  }

  const [{ AgentOrchestrator }, { MockCapabilityProvider }, { paymentWebhookService }, { getLocalJobQueueRuntime }] =
    await Promise.all([
      import('../src/agent/orchestrator/agent-orchestrator'),
      import('../src/capabilities/toolkit/providers/mock-capability.provider'),
      import('../src/application/services/payment-webhook.service'),
      import('../src/infrastructure/queue/job-queue.runtime'),
    ]);

  // Backend is the local orchestration entrypoint and should not call itself over HTTP.
  const provider: CapabilityProvider = new MockCapabilityProvider();

  return {
    orchestrator: new AgentOrchestrator(),
    provider,
    paymentWebhookService,
    runQueueTick: () => getLocalJobQueueRuntime().processDueJobs(),
    runtimeMode,
    dbHealth: () => getDbHealth(runtimeMode),
    recordTaskRun: (input) => {
      if (runtimeMode !== 'db') return;
      try {
        insertAgentTaskRun({
          task_run_id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          user_id: input.userId,
          session_id: input.sessionId,
          intent: input.intent,
          status: input.status,
          payload: input.payload,
          error_code: input.errorCode,
        });
      } catch (error) {
        console.warn('[backend] recordTaskRun failed:', error instanceof Error ? error.message : String(error));
      }
    },
  };
}
