import type { AgentStepRecord, LinkedAccount, MatchDetail, MatchSummary, Region } from '../../domain';

export interface AgentRuntimeState {
  userId: string;
  region: Region;
  linkedAccount?: LinkedAccount;
  matches: MatchSummary[];
  matchDetails: MatchDetail[];
  selectedMatch?: MatchDetail;
  steps: AgentStepRecord[];
}

export function createInitialState(userId: string, region: Region): AgentRuntimeState {
  return {
    userId,
    region,
    matches: [],
    matchDetails: [],
    steps: [],
  };
}
