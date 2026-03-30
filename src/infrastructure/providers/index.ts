import { loadGameProviderConfig } from '../config/game-provider-config';
import { AccountLinkingProviderRegistry } from './account-linking/account-linking-provider.registry';
import { CnAccountLinkingMockProvider } from './account-linking/cn/cn-account-linking.mock-provider';
import { InternationalAccountLinkingMockProvider } from './account-linking/intl/international-account-linking.mock-provider';
import { InternationalAccountLinkingRiotProvider } from './account-linking/intl/international-account-linking.riot-provider';
import { MatchImportProviderRegistry } from './match-import/match-import-provider.registry';
import { CnMatchImportMockProvider } from './match-import/cn/cn-match-import.mock-provider';
import { InternationalMatchImportMockProvider } from './match-import/intl/international-match-import.mock-provider';
import { InternationalMatchImportRiotProvider } from './match-import/intl/international-match-import.riot-provider';
import { StaticRegionRouter } from './region/static-region-router';

export function createMockProviderRegistries() {
  const gameProviderConfig = loadGameProviderConfig();

  const accountRegistry = new AccountLinkingProviderRegistry();
  if (gameProviderConfig.riot.enabled) {
    accountRegistry.register(
      new InternationalAccountLinkingRiotProvider(gameProviderConfig.riot, gameProviderConfig.riot.regionalRouting)
    );
  } else {
    accountRegistry.register(new InternationalAccountLinkingMockProvider());
  }
  accountRegistry.register(new CnAccountLinkingMockProvider());

  const matchRegistry = new MatchImportProviderRegistry();
  if (gameProviderConfig.riot.enabled) {
    matchRegistry.register(
      new InternationalMatchImportRiotProvider(gameProviderConfig.riot, gameProviderConfig.riot.regionalRouting)
    );
  } else {
    matchRegistry.register(new InternationalMatchImportMockProvider());
  }
  matchRegistry.register(new CnMatchImportMockProvider());

  const regionRouter = new StaticRegionRouter();

  return {
    regionRouter,
    accountRegistry,
    matchRegistry,
  };
}

export * from './region/region-router';
export * from './region/static-region-router';
export * from './account-linking/account-linking.provider';
export * from './account-linking/account-linking-provider.registry';
export * from './account-linking/intl/international-account-linking.mock-provider';
export * from './account-linking/intl/international-account-linking.riot-provider';
export * from './account-linking/cn/cn-account-linking.mock-provider';
export * from './match-import/match-import.provider';
export * from './match-import/match-import-provider.registry';
export * from './match-import/intl/international-match-import.mock-provider';
export * from './match-import/intl/international-match-import.riot-provider';
export * from './match-import/cn/cn-match-import.mock-provider';
export * from './riot/riot-http-client';
