import { HttpClient } from '../http-client';

export class DatabaseClient {
  constructor(private readonly http: HttpClient, private readonly apiKey?: string) {}

  async health(): Promise<{ ok: boolean; engine: string; latency_ms: number }> {
    return this.http.request({
      path: 'health',
      method: 'GET',
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });
  }

  async query<T>(input: { statement: string; params?: unknown[] }): Promise<{ rows: T[] }> {
    return this.http.request({
      path: 'query',
      method: 'POST',
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      body: input,
    });
  }
}
