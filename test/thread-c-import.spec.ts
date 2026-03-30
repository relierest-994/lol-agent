import { describe, expect, it } from 'vitest';
import { REGION_ROUTES } from '../src/domain';
import { MatchImportUseCase } from '../src/application';
import { createMockProviderRegistries } from '../src/infrastructure/providers';

describe('Thread C - Region/Account/Match Import', () => {
  it('has independent region route models with required fields', () => {
    const intl = REGION_ROUTES.INTERNATIONAL;
    const cn = REGION_ROUTES.CN;

    expect(intl.regionType).toBe('GLOBAL');
    expect(intl.regionKey).toBe('INTERNATIONAL');
    expect(intl.accountSystem).toBe('RIOT');
    expect(intl.dataSourceType).toBe('RIOT_API_MOCK');
    expect(intl.availableCapabilities.length).toBeGreaterThan(0);

    expect(cn.regionType).toBe('MAINLAND_CHINA');
    expect(cn.regionKey).toBe('CN');
    expect(cn.accountSystem).toBe('WEGAME_TENCENT');
    expect(cn.dataSourceType).toBe('WEGAME_API_MOCK');
    expect(cn.availableCapabilities.length).toBeGreaterThan(0);
  });

  it('supports separate account linking providers for international/cn', async () => {
    const registries = createMockProviderRegistries();
    const intlProvider = registries.accountRegistry.get('INTERNATIONAL');
    const cnProvider = registries.accountRegistry.get('CN');

    const intlAccount = await intlProvider.linkAccountMock('u-intl');
    const cnAccount = await cnProvider.linkAccountMock('u-cn');

    expect(intlProvider.providerId).toContain('intl');
    expect(cnProvider.providerId).toContain('cn');
    expect(intlAccount.region).toBe('INTERNATIONAL');
    expect(cnAccount.region).toBe('CN');
  });

  it('imports recent matches and supports target selection + timeline', async () => {
    const registries = createMockProviderRegistries();
    const useCase = new MatchImportUseCase(registries.matchRegistry);

    const intlMatches = await useCase.listRecent({
      region: 'INTERNATIONAL',
      accountId: 'riot-mock-intl-001',
      limit: 5,
    });

    expect(intlMatches.matches.length).toBeGreaterThanOrEqual(2);

    const selected = useCase.selectTarget({
      matches: intlMatches.matches,
    });
    expect(selected.selectedBy).toBe('latest');

    const bundle = await useCase.getMatchBundle('INTERNATIONAL', selected.selectedMatchId);
    expect(bundle.detail.timelineSignals).toBeDefined();
    expect(bundle.timeline?.events.length).toBeGreaterThan(0);
  });
});
