import type { MatchDetail, MatchSummary, MatchTimeline, Region } from '../../../domain';
import type { MatchImportProviderRegistry } from '../../../infrastructure/providers/match-import/match-import-provider.registry';
import { callBackendApi } from '../../http-api.client';

export interface QueryRecentMatchesInput {
  region: Region;
  accountId: string;
  limit?: number;
}

export interface QueryRecentMatchesOutput {
  matches: MatchSummary[];
}

export interface SelectTargetMatchInput {
  matches: MatchSummary[];
  preferredMatchId?: string;
}

export interface SelectTargetMatchOutput {
  selectedMatchId: string;
  selectedBy: 'preferred' | 'latest';
}

export interface MatchImportBundle {
  summary: MatchSummary;
  detail: MatchDetail;
  timeline?: MatchTimeline;
}

export class MatchImportUseCase {
  constructor(private readonly registry: MatchImportProviderRegistry) {}

  async listRecent(input: QueryRecentMatchesInput): Promise<QueryRecentMatchesOutput> {
    const provider = this.registry.get(input.region);
    const matches = await provider.listRecentMatches(input.accountId, input.limit ?? 10);
    return { matches };
  }

  selectTarget(input: SelectTargetMatchInput): SelectTargetMatchOutput {
    if (input.preferredMatchId) {
      const preferred = input.matches.find((item) => item.matchId === input.preferredMatchId);
      if (preferred) {
        return {
          selectedMatchId: preferred.matchId,
          selectedBy: 'preferred',
        };
      }
    }

    const latest = input.matches[0];
    if (!latest) throw new Error('No match available for selection');

    return {
      selectedMatchId: latest.matchId,
      selectedBy: 'latest',
    };
  }

  async getMatchBundle(region: Region, matchId: string): Promise<MatchImportBundle> {
    const provider = this.registry.get(region);
    const summary = await provider.getMatchSummary(matchId);
    const detail = await provider.getMatchDetail(matchId);
    const timeline = await provider.getMatchTimeline(matchId);

    if (!summary || !detail) {
      throw new Error(`Target match not found: ${matchId}`);
    }

    return {
      summary,
      detail,
      timeline,
    };
  }
}

export async function fetchRecentMatchesForLinkedAccount(input: {
  userId: string;
  region: Region;
  accountId: string;
  limit?: number;
}): Promise<MatchSummary[]> {
  const limit = input.limit ?? 10;
  const response = await callBackendApi<{ summaries: MatchSummary[]; details: MatchDetail[] }>({
    path: 'matches/recent',
    method: 'POST',
    body: {
      region: input.region,
      account_id: input.accountId,
      limit,
    },
  });
  return response.summaries;
}
