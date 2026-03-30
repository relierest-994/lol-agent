import type { MatchDetail, MatchSummary, MatchTimeline, Region } from '../../../domain';

export interface MatchImportProvider {
  readonly providerId: string;
  readonly region: Region;
  listRecentMatches(accountId: string, limit: number): Promise<MatchSummary[]>;
  getMatchSummary(matchId: string): Promise<MatchSummary | undefined>;
  getMatchDetail(matchId: string): Promise<MatchDetail | undefined>;
  getMatchTimeline(matchId: string): Promise<MatchTimeline | undefined>;
}
