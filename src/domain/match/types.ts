export type MatchOutcome = 'WIN' | 'LOSS';

export interface MatchSummary {
  matchId: string;
  championName: string;
  queue: string;
  outcome: MatchOutcome;
  kills: number;
  deaths: number;
  assists: number;
  durationMinutes: number;
  playedAt: string;
}

export interface MatchTimelineSignals {
  earlyDeaths: number;
  objectiveParticipation: number;
  visionScore: number;
  csPerMinute: number;
  roamingImpact: number;
}

export interface MatchTimelineEvent {
  minute: number;
  type: 'KILL' | 'DEATH' | 'OBJECTIVE' | 'TEAMFIGHT' | 'VISION';
  note: string;
}

export interface MatchTimeline {
  matchId: string;
  events: MatchTimelineEvent[];
}

export interface MatchDetail extends MatchSummary {
  timelineSignals: MatchTimelineSignals;
}
