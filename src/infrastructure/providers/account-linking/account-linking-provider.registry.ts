import type { AccountLinkingProvider } from './account-linking.provider';
import type { Region } from '../../../domain';

export class AccountLinkingProviderRegistry {
  private readonly providers = new Map<Region, AccountLinkingProvider>();

  register(provider: AccountLinkingProvider): void {
    this.providers.set(provider.region, provider);
  }

  get(region: Region): AccountLinkingProvider {
    const provider = this.providers.get(region);
    if (!provider) throw new Error(`No account provider registered for region ${region}`);
    return provider;
  }
}
