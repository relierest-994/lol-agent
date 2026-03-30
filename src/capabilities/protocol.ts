import type {
  BasicReviewReport,
  EntitlementFeature,
  LinkedAccount,
  MatchDetail,
  MatchSummary,
  Region,
} from '../domain';

export type CapabilityName =
  | 'account.link'
  | 'match.list'
  | 'match.pick-latest'
  | 'review.basic'
  | 'review.deep'
  | 'review.clip'
  | 'billing.guard';

export interface CapabilityContext {
  userId: string;
  region: Region;
  nowIso: string;
}

export interface CapabilityPayloads {
  'account.link': { linkedAccount?: LinkedAccount };
  'match.list': { account: LinkedAccount };
  'match.pick-latest': { matches: MatchSummary[] };
  'review.basic': { match: MatchDetail };
  'review.deep': { match: MatchDetail };
  'review.clip': { match: MatchDetail };
  'billing.guard': { feature: EntitlementFeature };
}

export interface CapabilityResults {
  'account.link': { account: LinkedAccount };
  'match.list': { matches: MatchSummary[]; details: MatchDetail[]; selected?: MatchDetail };
  'match.pick-latest': { selectedMatch: MatchSummary };
  'review.basic': { report: BasicReviewReport };
  'review.deep': { locked: boolean; reason: string };
  'review.clip': { locked: boolean; reason: string };
  'billing.guard': { allowed: boolean; reason?: string };
}

export interface CapabilityExecutionResult<T> {
  ok: boolean;
  summary: string;
  data?: T;
  error?: string;
}

export interface Capability<TName extends CapabilityName> {
  name: TName;
  execute: (
    context: CapabilityContext,
    payload: CapabilityPayloads[TName]
  ) => Promise<CapabilityExecutionResult<CapabilityResults[TName]>>;
}

export type CapabilityRegistry = {
  [K in CapabilityName]: Capability<K>;
};
