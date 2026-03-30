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
  constructor(private readonly options: HttpClientOptions) {}

  async request<T>(request: HttpRequestOptions): Promise<T> {
    const method = request.method ?? 'GET';
    const url = `${this.options.baseUrl.replace(/\/$/, '')}/${request.path.replace(/^\//, '')}`;

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
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Error(`REQUEST_TIMEOUT: request to ${url} timed out`);
    }

    const message = error instanceof Error ? error.message : String(error);
    if (/Failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
      return new Error(`NETWORK_ERROR: unable to reach ${url}. ${message}`);
    }

    return error instanceof Error ? error : new Error('HTTP request failed');
  }
}
