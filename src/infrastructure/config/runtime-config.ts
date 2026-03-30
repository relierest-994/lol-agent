export type RuntimeMode = 'real' | 'mock';

export interface RuntimeConfig {
  appEnv: 'dev' | 'staging' | 'prod' | string;
  providerMode: RuntimeMode;
  useBackendApi: boolean;
  queueRuntimeMode: 'http' | 'local';
  allowMockFallback: boolean;
  apiBaseUrl: string;
  requestTimeoutMs: number;
  requestRetries: number;
  llmApiUrl: string;
  llmApiKey?: string;
  llmModel: string;
  llmEnabled: boolean;
  videoApiUrl: string;
  videoApiKey?: string;
  videoLlmModel: string;
  storageApiUrl: string;
  storageBucket: string;
  queueApiUrl: string;
  queueName: string;
  paymentApiUrl: string;
  paymentApiKey?: string;
  paymentWebhookSecret?: string;
  aiFollowupPaid: boolean;
  clipReviewPaid: boolean;
}

function readEnv(): Record<string, string | undefined> {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const viteEnv = (globalThis as { __VITE_ENV__?: Record<string, string | undefined> }).__VITE_ENV__;

  if (viteEnv) return { ...processEnv, ...viteEnv };

  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return { ...processEnv, ...meta };
}

function isServerRuntime(): boolean {
  return typeof window === 'undefined';
}

function pickEnv(
  env: Record<string, string | undefined>,
  keys: { server?: string; client?: string; shared?: string; defaultValue?: string }
): string | undefined {
  if (isServerRuntime()) {
    return (keys.server ? env[keys.server] : undefined) ?? (keys.shared ? env[keys.shared] : undefined) ?? keys.defaultValue;
  }
  return (keys.client ? env[keys.client] : undefined) ?? (keys.shared ? env[keys.shared] : undefined) ?? keys.defaultValue;
}

function asBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function asNum(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const env = readEnv();

  const providerModeRaw = pickEnv(env, {
    client: 'VITE_APP_PROVIDER_MODE',
    defaultValue: 'real',
  })!;
  const providerMode: RuntimeMode = providerModeRaw === 'mock' ? 'mock' : 'real';

  return {
    appEnv: pickEnv(env, {
      server: 'APP_ENV',
      client: 'VITE_APP_ENV',
      defaultValue: 'dev',
    })!,
    providerMode,
    useBackendApi: asBool(pickEnv(env, { client: 'VITE_USE_BACKEND_API' }), false),
    queueRuntimeMode: (env.QUEUE_RUNTIME_MODE ?? env.APP_QUEUE_RUNTIME_MODE ?? 'http') === 'local' ? 'local' : 'http',
    allowMockFallback: asBool(
      pickEnv(env, {
        server: 'APP_ALLOW_MOCK_FALLBACK',
        client: 'VITE_APP_ALLOW_MOCK_FALLBACK',
      }),
      true
    ),
    apiBaseUrl: pickEnv(env, {
      server: 'API_BASE_URL',
      client: 'VITE_API_BASE_URL',
      defaultValue: 'http://localhost:8080',
    })!,
    requestTimeoutMs: asNum(
      pickEnv(env, {
        server: 'REQUEST_TIMEOUT_MS',
        client: 'VITE_REQUEST_TIMEOUT_MS',
      }),
      10000
    ),
    requestRetries: asNum(
      pickEnv(env, {
        server: 'REQUEST_RETRIES',
        client: 'VITE_REQUEST_RETRIES',
      }),
      1
    ),

    llmApiUrl: env.LLM_API_URL ?? env.VITE_LLM_API_URL ?? 'https://api.openai.com/v1/chat/completions',
    llmApiKey: env.LLM_API_KEY ?? env.VITE_LLM_API_KEY,
    llmModel: env.LLM_MODEL ?? env.VITE_LLM_MODEL ?? 'gpt-4.1-mini',
    llmEnabled: asBool(env.LLM_ENABLED ?? env.VITE_LLM_ENABLED, true),

    videoApiUrl: env.VIDEO_API_URL ?? env.VITE_VIDEO_API_URL ?? 'http://localhost:8080/providers/video-diagnosis',
    videoApiKey: env.VIDEO_API_KEY ?? env.VITE_VIDEO_API_KEY,
    videoLlmModel: env.VIDEO_LLM_MODEL ?? env.VITE_VIDEO_LLM_MODEL ?? 'gpt-4.1-mini',

    storageApiUrl: env.STORAGE_API_URL ?? env.VITE_STORAGE_API_URL ?? 'http://localhost:8080/storage',
    storageBucket: env.STORAGE_BUCKET ?? env.VITE_STORAGE_BUCKET ?? 'lol-agent-stage',

    queueApiUrl: env.QUEUE_API_URL ?? env.VITE_QUEUE_API_URL ?? 'http://localhost:8080/queue',
    queueName: env.QUEUE_NAME ?? env.VITE_QUEUE_NAME ?? 'video_diagnosis',

    paymentApiUrl: env.PAYMENT_API_URL ?? env.VITE_PAYMENT_API_URL ?? 'http://localhost:8080/payments',
    paymentApiKey: env.PAYMENT_API_KEY ?? env.VITE_PAYMENT_API_KEY,
    paymentWebhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    aiFollowupPaid: asBool(env.APP_AI_FOLLOWUP_PAID ?? env.VITE_APP_AI_FOLLOWUP_PAID, true),
    clipReviewPaid: asBool(env.APP_CLIP_REVIEW_PAID ?? env.VITE_APP_CLIP_REVIEW_PAID, true),
  };
}
