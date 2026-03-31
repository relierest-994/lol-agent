import type { LinkedAccount } from '../../../../domain';
import type { RiotProviderConfig } from '../../../config/game-provider-config';
import { createPersistentStateStore } from '../../../persistence/persistent-state.store';
import { RiotHttpClient, type RiotRegionalRouting } from '../../riot/riot-http-client';
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
      const detail = error instanceof Error ? error.message : String(error);
      if (/status_code\":404|Riot API 404|not found/i.test(detail)) {
        throw new Error(`Riot account not found: ${gameName}#${tagLine}. Please verify gameName and tagLine.`);
      }
      throw new Error(`Riot account link failed for ${gameName}#${tagLine}: ${detail}`);
    }
  }
}
