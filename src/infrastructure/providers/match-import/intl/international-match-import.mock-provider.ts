import type { MatchDetail, MatchSummary, MatchTimeline } from '../../../../domain';
import type { MatchImportProvider } from '../match-import.provider';

const intlDetails: MatchDetail[] = [
  {
    matchId: 'EUW-1001',
    championName: 'Ahri',
    queue: 'Ranked Solo',
    outcome: 'LOSS',
    kills: 8,
    deaths: 7,
    assists: 5,
    durationMinutes: 31,
    playedAt: '2026-03-29T16:22:00.000Z',
    timelineSignals: {
      earlyDeaths: 3,
      objectiveParticipation: 0.34,
      visionScore: 19,
      csPerMinute: 6.4,
      roamingImpact: 0.46,
    },
  },
  {
    matchId: 'EUW-1000',
    championName: 'Syndra',
    queue: 'Ranked Solo',
    outcome: 'WIN',
    kills: 11,
    deaths: 3,
    assists: 9,
    durationMinutes: 28,
    playedAt: '2026-03-28T13:12:00.000Z',
    timelineSignals: {
      earlyDeaths: 0,
      objectiveParticipation: 0.58,
      visionScore: 26,
      csPerMinute: 7.8,
      roamingImpact: 0.71,
    },
  },
  {
    matchId: 'EUW-0999',
    championName: 'Orianna',
    queue: 'Ranked Solo',
    outcome: 'WIN',
    kills: 6,
    deaths: 2,
    assists: 11,
    durationMinutes: 29,
    playedAt: '2026-03-27T15:12:00.000Z',
    timelineSignals: {
      earlyDeaths: 1,
      objectiveParticipation: 0.61,
      visionScore: 28,
      csPerMinute: 7.1,
      roamingImpact: 0.67,
    },
  },
];

const intlTimelines: Record<string, MatchTimeline> = {
  'EUW-1001': {
    matchId: 'EUW-1001',
    events: [
      { minute: 4, type: 'DEATH', note: '河道无视野被抓' },
      { minute: 9, type: 'DEATH', note: '越线压制被反蹲' },
      { minute: 14, type: 'OBJECTIVE', note: '未及时支援先锋团' },
      { minute: 23, type: 'TEAMFIGHT', note: '中路团战先手失败' },
    ],
  },
  'EUW-1000': {
    matchId: 'EUW-1000',
    events: [
      { minute: 6, type: 'KILL', note: '中野联动击杀敌方法师' },
      { minute: 12, type: 'OBJECTIVE', note: '控下第一条小龙' },
      { minute: 20, type: 'TEAMFIGHT', note: '河道团战双C收割' },
    ],
  },
  'EUW-0999': {
    matchId: 'EUW-0999',
    events: [
      { minute: 8, type: 'KILL', note: '下路游走成功' },
      { minute: 18, type: 'VISION', note: '提前布控大龙视野' },
      { minute: 26, type: 'TEAMFIGHT', note: '团战拉扯打赢' },
    ],
  },
};

export class InternationalMatchImportMockProvider implements MatchImportProvider {
  readonly providerId = 'intl-riot-match-mock';
  readonly region = 'INTERNATIONAL' as const;

  async listRecentMatches(_accountId: string, limit: number): Promise<MatchSummary[]> {
    return intlDetails.map(stripDetail).slice(0, limit);
  }

  async getMatchSummary(matchId: string): Promise<MatchSummary | undefined> {
    const detail = intlDetails.find((item) => item.matchId === matchId);
    return detail ? stripDetail(detail) : undefined;
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail | undefined> {
    return intlDetails.find((item) => item.matchId === matchId);
  }

  async getMatchTimeline(matchId: string): Promise<MatchTimeline | undefined> {
    return intlTimelines[matchId];
  }
}

function stripDetail(detail: MatchDetail): MatchSummary {
  const { timelineSignals, ...summary } = detail;
  return summary;
}
