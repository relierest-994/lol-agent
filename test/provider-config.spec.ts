import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../src/infrastructure/config/runtime-config';
import { validateProviderConfig } from '../src/infrastructure/config/provider-config.validator';

describe('Provider config validation', () => {
  it('accepts default runtime config', () => {
    const config = loadRuntimeConfig();
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid endpoint urls', () => {
    const config = loadRuntimeConfig();
    const result = validateProviderConfig({
      ...config,
      apiBaseUrl: 'not-a-url',
      storageApiUrl: 'still-bad',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
