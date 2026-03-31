import type { LinkedAccount } from '../../../../domain';
import type { RiotProviderConfig } from '../../../config/game-provider-config';
import { createPersistentStateStore } from '../../../persistence/persistent-state.store';
import { RiotHttpClient, type RiotRegionalRouting } from '../../riot/riot-http-client';
import { InternationalAccountLinkingMockProvider } from './international-account-linking.mock-provider';
import type { AccountLinkingProvider, LinkAccountRequest } from '../account-linking.provider';

interface RiotAccountByIdResponse {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export class InternationalAccountLinkingRiotProvider implements AccountLinkingProvider {
  readonly providerId = 'intl-riot-real';
  readonly region = 'INTERNATIONAL' as const;

  private readonly store = createPersistentStateStore('account-link-intl');
  private readonly client: RiotHttpClient;
  private readonly mockFallback = new InternationalAccountLinkingMockProvider();

  constructor(config: RiotProviderConfig, regionalRouting: RiotRegionalRouting) {
    this.client = new RiotHttpClient({
      config,
      regionalRouting,
    });
  }

  async getLinkStatus(userId: string): Promise<{ linked: boolean; account?: LinkedAccount }> {
    const account = this.store.read<LinkedAccount | undefined>(`account:${userId}`);
    if (!account) return { linked: false };
    if (typeof account.accountId !== 'string' || account.accountId.length === 0) {
      this.store.remove(`account:${userId}`);
      return { linked: false };
    }

    // Clean up legacy mock-linked account ids so the user is forced to re-link with a real Riot account.
    if (account.accountId.startsWith('riot-mock-') || account.accountId.startsWith('wegame-mock-')) {
      this.store.remove(`account:${userId}`);
      return { linked: false };
    }

    return { linked: true, account };
  }

  async linkAccountMock(userId: string, request?: LinkAccountRequest): Promise<LinkedAccount> {
    const gameName = request?.gameName?.trim();
    const tagLine = request?.tagLine?.trim();

    if (!gameName || !tagLine) {
      throw new Error('国际服绑定需要 gameName 与 tagLine');
    }

    try {
      const account = await this.client.request<RiotAccountByIdResponse>(
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
      );

      const linked: LinkedAccount = {
        accountId: account.puuid,
        region: this.region,
        gameName: account.gameName,
        tagLine: account.tagLine,
        linkedAt: new Date().toISOString(),
      };

      this.store.write(`account:${userId}`, linked);
      return linked;
    } catch (error) {
      if (!shouldFallbackToMock(error)) throw error;
      const linked = await this.mockFallback.linkAccountMock(userId, request);
      this.store.write(`account:${userId}`, linked);
      return linked;
    }
  }
}

function shouldFallbackToMock(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Riot API 401|Riot API 403|Forbidden|status_code\":401|status_code\":403|fetch failed|network/i.test(message);
}
