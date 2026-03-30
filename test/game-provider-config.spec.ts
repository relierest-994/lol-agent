import { describe, expect, it } from 'vitest';
import { validateGameProviderConfig } from '../src/infrastructure/config/game-provider-config';

describe('Game provider config validation', () => {
  it('rejects enabled riot provider without api key', () => {
    const result = validateGameProviderConfig({
      riot: {
        enabled: true,
        apiBaseUrl: 'https://kr.api.riotgames.com',
        apiKey: undefined,
      },
      wegame: {
        enabled: false,
        authUrl: '',
        tokenUrl: '',
        profileUrl: '',
      },
    });
    expect(result.valid).toBe(false);
  });

  it('accepts enabled wegame oauth config', () => {
    const result = validateGameProviderConfig({
      riot: {
        enabled: false,
        apiBaseUrl: 'https://kr.api.riotgames.com',
      },
      wegame: {
        enabled: true,
        authUrl: 'https://oauth.wegame.qq.com/authorize',
        tokenUrl: 'https://oauth.wegame.qq.com/token',
        profileUrl: 'https://oauth.wegame.qq.com/profile',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://app.example.com/auth/wegame/callback',
      },
    });
    expect(result.valid).toBe(true);
  });
});

