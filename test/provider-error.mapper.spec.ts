import { describe, expect, it } from 'vitest';
import { mapProviderError } from '../src/infrastructure/providers/provider-error.mapper';

describe('ProviderErrorMapper', () => {
  it('maps timeout errors as retryable timeout', () => {
    const mapped = mapProviderError(new Error('request aborted by timeout'));
    expect(mapped.code).toBe('TIMEOUT');
    expect(mapped.retryable).toBe(true);
  });

  it('maps auth errors as non-retryable unauthorized', () => {
    const mapped = mapProviderError(new Error('HTTP 401 unauthorized'));
    expect(mapped.code).toBe('UNAUTHORIZED');
    expect(mapped.retryable).toBe(false);
  });

  it('maps rate limit errors as retryable', () => {
    const mapped = mapProviderError(new Error('HTTP 429 too many requests'));
    expect(mapped.code).toBe('RATE_LIMITED');
    expect(mapped.retryable).toBe(true);
  });
});
