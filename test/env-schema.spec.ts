import { describe, expect, it } from 'vitest';
import { validateRuntimeEnvSchema } from '../src/infrastructure/config/env-schema';
import { loadRuntimeConfig } from '../src/infrastructure/config/runtime-config';

describe('Runtime env schema', () => {
  it('flags missing secrets in prod env', () => {
    const config = loadRuntimeConfig();
    const result = validateRuntimeEnvSchema({
      ...config,
      appEnv: 'prod',
      llmApiKey: undefined,
      paymentApiKey: undefined,
      videoApiKey: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts complete staging/prod secrets', () => {
    const config = loadRuntimeConfig();
    const result = validateRuntimeEnvSchema({
      ...config,
      appEnv: 'staging',
      llmApiKey: 'k1',
      paymentApiKey: 'k2',
      videoApiKey: 'k3',
    });
    expect(result.valid).toBe(true);
  });
});
