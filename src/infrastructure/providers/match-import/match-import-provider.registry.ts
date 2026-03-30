import type { Region } from '../../../domain';
import type { MatchImportProvider } from './match-import.provider';

export class MatchImportProviderRegistry {
  private readonly providers = new Map<Region, MatchImportProvider>();

  register(provider: MatchImportProvider): void {
    this.providers.set(provider.region, provider);
  }

  get(region: Region): MatchImportProvider {
    const provider = this.providers.get(region);
    if (!provider) throw new Error(`No match provider registered for region ${region}`);
    return provider;
  }
}
