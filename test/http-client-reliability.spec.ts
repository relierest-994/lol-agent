import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/infrastructure/clients';

describe('HttpClient reliability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries transient failures and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary failure', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({
      baseUrl: 'http://localhost:8080',
      timeoutMs: 100,
      retries: 1,
    });

    const data = await client.request<{ ok: boolean }>({ path: 'health' });
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('times out aborted request', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({
      baseUrl: 'http://localhost:8080',
      timeoutMs: 20,
      retries: 0,
    });

    await expect(client.request({ path: 'slow' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
