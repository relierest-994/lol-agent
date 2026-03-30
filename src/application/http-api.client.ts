import { HttpClient } from '../infrastructure/clients/http-client';
import { loadRuntimeConfig } from '../infrastructure/config/runtime-config';

let sharedClient: HttpClient | undefined;

function isBackendApiEnabled(): boolean {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const raw = processEnv.VITE_USE_BACKEND_API ?? processEnv.APP_USE_BACKEND_API ?? metaEnv.VITE_USE_BACKEND_API ?? 'false';
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function getClient(): HttpClient {
  if (sharedClient) return sharedClient;
  const config = loadRuntimeConfig();
  sharedClient = new HttpClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.requestTimeoutMs,
    retries: config.requestRetries,
  });
  return sharedClient;
}

export async function callBackendApi<T>(input: {
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> {
  if (!isBackendApiEnabled()) {
    throw new Error('Backend API integration is disabled');
  }
  const client = getClient();
  return client.request<T>({
    path: input.path,
    method: input.method ?? 'GET',
    body: input.body,
  });
}
