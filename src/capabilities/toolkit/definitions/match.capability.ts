import type { MatchSummary, Region } from '../../../domain';
import { STANDARD_ERROR_SCHEMA, invalidInput, notFound, providerError } from '../errors';
import type { CapabilityDefinition } from '../types';

export interface MatchListRecentInput {
  userId: string;
  region: Region;
  accountId: string;
  limit?: number;
}

export interface MatchListRecentOutput {
  matches: MatchSummary[];
}

export const matchListRecentCapability: CapabilityDefinition<MatchListRecentInput, MatchListRecentOutput> = {
  id: 'match.list_recent',
  title: 'List recent matches for account',
  inputSchema: {
    type: 'object',
    required: ['userId', 'region', 'accountId'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      region: { type: 'string', description: 'Region', enum: ['INTERNATIONAL', 'CN'] },
      accountId: { type: 'string', description: 'Linked account id' },
      limit: { type: 'number', description: 'Optional size limit' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['matches'],
    properties: {
      matches: { type: 'array', description: 'Recent match summaries' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Free capability',
  },
  async invoke(_context, input, provider) {
    if (!input.accountId) return invalidInput('accountId is required');

    try {
      const list = await provider.listRecentMatches(input.region, input.accountId, input.limit ?? 10);
      return {
        ok: true,
        data: {
          matches: list.summaries.slice(0, input.limit ?? 10),
        },
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown';
      if (/Riot API 403/i.test(detail)) {
        return providerError('拉取最近对局失败：Riot 鉴权失败', detail);
      }
      if (/Riot API 429/i.test(detail)) {
        return providerError('拉取最近对局失败：Riot 接口限流', detail);
      }
      return providerError('Failed to list recent matches', detail);
    }
  },
};

export interface MatchSelectTargetInput {
  matches: MatchSummary[];
  preferredMatchId?: string;
}

export interface MatchSelectTargetOutput {
  selectedMatchId: string;
  selectedBy: 'preferred' | 'latest';
}

export const matchSelectTargetCapability: CapabilityDefinition<MatchSelectTargetInput, MatchSelectTargetOutput> = {
  id: 'match.select_target',
  title: 'Select target match for review',
  inputSchema: {
    type: 'object',
    required: ['matches'],
    properties: {
      matches: { type: 'array', description: 'Recent matches' },
      preferredMatchId: { type: 'string', description: 'Optional user-selected match id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['selectedMatchId', 'selectedBy'],
    properties: {
      selectedMatchId: { type: 'string', description: 'Selected target match id' },
      selectedBy: { type: 'string', description: 'Selection source', enum: ['preferred', 'latest'] },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Free capability',
  },
  async invoke(_context, input) {
    if (!input.matches.length) return notFound('No matches available');

    if (input.preferredMatchId) {
      const preferred = input.matches.find((item) => item.matchId === input.preferredMatchId);
      if (preferred) {
        return {
          ok: true,
          data: {
            selectedMatchId: preferred.matchId,
            selectedBy: 'preferred',
          },
        };
      }
    }

    const latest = input.matches[0];
    if (!latest) return notFound('No latest match available');

    return {
      ok: true,
      data: {
        selectedMatchId: latest.matchId,
        selectedBy: 'latest',
      },
    };
  },
};
