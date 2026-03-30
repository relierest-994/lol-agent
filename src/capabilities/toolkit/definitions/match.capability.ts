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
      return providerError('Failed to list recent matches', error instanceof Error ? error.message : 'Unknown');
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
