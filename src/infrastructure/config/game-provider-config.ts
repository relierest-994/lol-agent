export interface RiotProviderConfig {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
}

export interface WegameProviderConfig {
  enabled: boolean;
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface GameProviderConfig {
  riot: RiotProviderConfig;
  wegame: WegameProviderConfig;
}

export interface GameProviderConfigValidation {
  valid: boolean;
  errors: string[];
}

function readEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function asBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function asUrl(raw: string | undefined, fallback: string): string {
  return raw?.trim() || fallback;
}

export function loadGameProviderConfig(): GameProviderConfig {
  const env = readEnv();
  return {
    riot: {
      enabled: asBool(env.RIOT_PROVIDER_ENABLED, false),
      apiBaseUrl: asUrl(env.RIOT_API_BASE_URL, 'https://REGION.api.riotgames.com'),
      apiKey: env.RIOT_API_KEY,
    },
    wegame: {
      enabled: asBool(env.WEGAME_PROVIDER_ENABLED, false),
      authUrl: asUrl(env.WEGAME_OAUTH_AUTH_URL, ''),
      tokenUrl: asUrl(env.WEGAME_OAUTH_TOKEN_URL, ''),
      profileUrl: asUrl(env.WEGAME_OAUTH_PROFILE_URL, ''),
      clientId: env.WEGAME_OAUTH_CLIENT_ID,
      clientSecret: env.WEGAME_OAUTH_CLIENT_SECRET,
      redirectUri: env.WEGAME_OAUTH_REDIRECT_URI,
    },
  };
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function validateGameProviderConfig(config: GameProviderConfig): GameProviderConfigValidation {
  const errors: string[] = [];

  if (config.riot.enabled) {
    if (!isHttpUrl(config.riot.apiBaseUrl)) errors.push('RIOT_API_BASE_URL must be a valid http(s) URL');
    if (!config.riot.apiKey) errors.push('RIOT_API_KEY is required when RIOT_PROVIDER_ENABLED=true');
  }

  if (config.wegame.enabled) {
    if (!isHttpUrl(config.wegame.authUrl)) errors.push('WEGAME_OAUTH_AUTH_URL must be a valid http(s) URL');
    if (!isHttpUrl(config.wegame.tokenUrl)) errors.push('WEGAME_OAUTH_TOKEN_URL must be a valid http(s) URL');
    if (!isHttpUrl(config.wegame.profileUrl)) errors.push('WEGAME_OAUTH_PROFILE_URL must be a valid http(s) URL');
    if (!config.wegame.clientId) errors.push('WEGAME_OAUTH_CLIENT_ID is required when WEGAME_PROVIDER_ENABLED=true');
    if (!config.wegame.clientSecret) errors.push('WEGAME_OAUTH_CLIENT_SECRET is required when WEGAME_PROVIDER_ENABLED=true');
    if (!config.wegame.redirectUri) errors.push('WEGAME_OAUTH_REDIRECT_URI is required when WEGAME_PROVIDER_ENABLED=true');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

