import type { LinkedAccount } from '../../../../domain';
import { createPersistentStateStore } from '../../../persistence/persistent-state.store';
import type { AccountLinkingProvider } from '../account-linking.provider';

const baseCnAccount: Omit<LinkedAccount, 'region'> = {
  accountId: 'wegame-mock-cn-001',
  gameName: '上分代理',
  tagLine: '艾欧尼亚',
  linkedAt: new Date('2026-01-10T10:00:00.000Z').toISOString(),
};

export class CnAccountLinkingMockProvider implements AccountLinkingProvider {
  readonly providerId = 'cn-wegame-mock';
  readonly region = 'CN' as const;
  private readonly store = createPersistentStateStore('account-link-cn');

  async getLinkStatus(userId: string): Promise<{ linked: boolean; account?: LinkedAccount }> {
    const account = this.store.read<LinkedAccount>(`account:${userId}`);
    return { linked: Boolean(account), account };
  }

  async linkAccountMock(userId: string): Promise<LinkedAccount> {
    const account: LinkedAccount = {
      ...baseCnAccount,
      region: this.region,
      linkedAt: new Date().toISOString(),
    };
    this.store.write(`account:${userId}`, account);
    return account;
  }
}
