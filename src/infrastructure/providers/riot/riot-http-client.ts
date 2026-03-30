import type { RiotProviderConfig } from '../../config/game-provider-config';

export type RiotRegionalRouting = 'americas' | 'asia' | 'europe' | 'sea';

export interface RiotHttpClientOptions {
  config: RiotProviderConfig;
  regionalRouting: RiotRegionalRouting;
}

export class RiotHttpClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options: RiotHttpClientOptions) {
    this.apiKey = options.config.apiKey;
    this.baseUrl = resolveRiotBaseUrl(options.config.apiBaseUrl, options.regionalRouting);
  }

  async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        ...(this.apiKey ? { 'X-Riot-Token': this.apiKey } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Riot API ${response.status}: ${text || 'request failed'}`);
    }

    return (await response.json()) as T;
  }
}

function resolveRiotBaseUrl(baseUrl: string, regionalRouting: RiotRegionalRouting): string {
  const normalized = baseUrl.trim();
  if (!normalized) return `https://${regionalRouting}.api.riotgames.com`;

  if (normalized.includes('REGION')) {
    return normalized.replace(/REGION/g, regionalRouting).replace(/\/$/, '');
  }

  return normalized.replace(/\/$/, '');
}

