import { describe, expect, it } from 'vitest';
import { createRealCapabilityProvider } from '../src/capabilities/toolkit/providers/real-capability.provider';

describe('RealCapabilityProvider fallback', () => {
  it('falls back to mock path when real infra is unavailable', async () => {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (!env) return;
    const backup = { ...env };
    env.VITE_APP_PROVIDER_MODE = 'real';
    env.APP_ALLOW_MOCK_FALLBACK = 'true';
    env.API_BASE_URL = 'http://127.0.0.1:1';
    env.LLM_API_URL = 'http://127.0.0.1:1';
    env.LLM_ENABLED = 'true';
    env.LLM_API_KEY = 'test-key';

    try {
      const provider = createRealCapabilityProvider();
      const output = await provider.generateDeepReview({
        userId: 'fallback-u1',
        region: 'INTERNATIONAL',
        accountId: 'acc-1',
        matchId: 'EUW-1001',
        authorizationContext: { entitlement_checked: true },
        nowIso: new Date().toISOString(),
      });

      expect(output.result.status).toBe('COMPLETED');
      expect(output.result.render_payload.sections.length).toBeGreaterThan(0);
    } finally {
      for (const key of Object.keys(env)) {
        if (!(key in backup)) delete env[key];
      }
      for (const [key, value] of Object.entries(backup)) {
        env[key] = value;
      }
    }
  });
});
