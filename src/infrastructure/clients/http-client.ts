import { logger } from '../observability/logger';

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  defaultHeaders?: Record<string, string>;
}

export interface HttpRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export class HttpClient {
  private static resolvedReactNativeDevHost: string | null | undefined;

  constructor(private readonly options: HttpClientOptions) {}

  async request<T>(request: HttpRequestOptions): Promise<T> {
    const method = request.method ?? 'GET';
    const baseUrl = await this.resolveBaseUrlForRuntime();
    const url = `${baseUrl.replace(/\/$/, '')}/${request.path.replace(/^\//, '')}`;

    const maxAttempt = Math.max(0, this.options.retries) + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempt; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.options.timeoutMs);

        const response = await fetch(url, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(this.options.defaultHeaders ?? {}),
            ...(request.headers ?? {}),
          },
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text || 'request failed'}`);
        }

        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        logger.warn('HTTP request attempt failed', {
          component: 'http-client',
          url,
          method,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const normalized = this.normalizeNetworkError(lastError, url);
    throw normalized;
  }

  private normalizeNetworkError(error: unknown, url: string): Error {
    if (this.isAbortError(error)) {
      return new Error(`REQUEST_TIMEOUT: request to ${url} timed out`);
    }

    const message = error instanceof Error ? error.message : String(error);
    if (
      /Network request failed|Failed to fetch|fetch failed/i.test(message) &&
      /https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)
    ) {
      return new Error(
        `NETWORK_ERROR: mobile runtime cannot reach localhost (${url}). Please set EXPO_PUBLIC_API_BASE_URL to your LAN host (e.g. http://192.168.x.x:8080) or set EXPO_PUBLIC_DEV_SERVER_HOST.`
      );
    }
    if (/Failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
      return new Error(`NETWORK_ERROR: unable to reach ${url}. ${message}`);
    }

    return error instanceof Error ? error : new Error('HTTP request failed');
  }

  private isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeName = (error as { name?: unknown }).name;
    return maybeName === 'AbortError';
  }

  private async resolveBaseUrlForRuntime(): Promise<string> {
    const configured = this.options.baseUrl;
    const loopback = await this.rewriteLoopbackHost(configured);
    return loopback ?? configured;
  }

  private async rewriteLoopbackHost(baseUrl: string): Promise<string | undefined> {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return undefined;
    }

    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return undefined;
    }

    const host = HttpClient.resolvedReactNativeDevHost ?? (await this.detectReactNativeDevHost());
    if (!host) return undefined;
    HttpClient.resolvedReactNativeDevHost = host;
    parsed.hostname = host;
    return parsed.toString().replace(/\/$/, '');
  }

  private async detectReactNativeDevHost(): Promise<string | undefined> {
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    const envHost = processEnv.EXPO_PUBLIC_DEV_SERVER_HOST ?? processEnv.EXPO_PUBLIC_HOST;
    if (envHost) return envHost;

    try {
      const constantsMod = (await import('expo-constants')) as {
        default?: {
          expoConfig?: { hostUri?: string };
          manifest?: { debuggerHost?: string };
          manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
        };
      };
      const constants = constantsMod?.default;
      const hostUri =
        constants?.expoConfig?.hostUri ??
        constants?.manifest2?.extra?.expoClient?.hostUri ??
        constants?.manifest?.debuggerHost;
      if (typeof hostUri === 'string' && hostUri.length > 0) {
        return hostUri.split(':')[0];
      }
    } catch {
      // ignore
    }

    try {
      const rn = (await import('react-native')) as { NativeModules?: { SourceCode?: { scriptURL?: string } } };
      const scriptURL = rn?.NativeModules?.SourceCode?.scriptURL;
      if (typeof scriptURL === 'string' && scriptURL.startsWith('http')) {
        return new URL(scriptURL).hostname;
      }
    } catch {
      // ignore
    }

    return undefined;
  }
}
