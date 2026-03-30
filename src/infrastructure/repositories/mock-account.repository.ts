import type { LinkedAccount, Region } from '../../domain';

const regionBase: Record<Region, Omit<LinkedAccount, 'region'>> = {
  INTERNATIONAL: {
    accountId: 'mock-intl-001',
    gameName: 'AgentCarry',
    tagLine: 'EUW',
    linkedAt: new Date('2026-01-10T10:00:00.000Z').toISOString(),
  },
  CN: {
    accountId: 'mock-cn-001',
    gameName: '上分代理',
    tagLine: '艾欧尼亚',
    linkedAt: new Date('2026-01-10T10:00:00.000Z').toISOString(),
  },
};

export class MockAccountRepository {
  async link(region: Region): Promise<LinkedAccount> {
    const base = regionBase[region];
    return { ...base, region };
  }
}
