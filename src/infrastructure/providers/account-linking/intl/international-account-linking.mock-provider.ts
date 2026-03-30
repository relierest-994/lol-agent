import type { LinkedAccount } from '../../../../domain';
import { createPersistentStateStore } from '../../../persistence/persistent-state.store';
import type { AccountLinkingProvider } from '../account-linking.provider';

const baseIntlAccount: Omit<LinkedAccount, 'region'> = {
  accountId: 'riot-mock-intl-001',
  gameName: 'AgentCarry',
  tagLine: 'EUW',
  linkedAt: new Date('2026-01-10T10:00:00.000Z').toISOString(),
};

export class InternationalAccountLinkingMockProvider implements AccountLinkingProvider {
  readonly providerId = 'intl-riot-mock';
  readonly region = 'INTERNATIONAL' as const;
  private readonly store = createPersistentStateStore('account-link-intl');

  async getLinkStatus(userId: string): Promise<{ linked: boolean; account?: LinkedAccount }> {
    const account = this.store.read<LinkedAccount>(`account:${userId}`);
    return { linked: Boolean(account), account };
  }

  async linkAccountMock(userId: string): Promise<LinkedAccount> {
    const account: LinkedAccount = {
      ...baseIntlAccount,
      region: this.region,
      linkedAt: new Date().toISOString(),
    };
    this.store.write(`account:${userId}`, account);
    return account;
  }
}
