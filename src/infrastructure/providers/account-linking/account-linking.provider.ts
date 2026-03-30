import type { LinkedAccount, Region } from '../../../domain';

export interface LinkAccountRequest {
  gameName?: string;
  tagLine?: string;
}

export interface AccountLinkingProvider {
  readonly providerId: string;
  readonly region: Region;
  getLinkStatus(userId: string): Promise<{ linked: boolean; account?: LinkedAccount }>;
  linkAccountMock(userId: string, request?: LinkAccountRequest): Promise<LinkedAccount>;
}
