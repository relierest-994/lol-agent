import type { Region } from '../region/types';

export interface LinkedAccount {
  accountId: string;
  region: Region;
  gameName: string;
  tagLine: string;
  linkedAt: string;
}

export interface AccountLinkRequest {
  userId: string;
  region: Region;
}
