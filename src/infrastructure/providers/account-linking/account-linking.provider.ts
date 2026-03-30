import type { LinkedAccount, Region } from '../../../domain';

export interface AccountLinkingProvider {
  readonly providerId: string;
  readonly region: Region;
  getLinkStatus(userId: string): Promise<{ linked: boolean; account?: LinkedAccount }>;
  linkAccountMock(userId: string): Promise<LinkedAccount>;
}
