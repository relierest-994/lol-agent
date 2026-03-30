import type { MatchDetail, MatchSummary, MatchTimeline } from '../../../../domain';
import type { MatchImportProvider } from '../match-import.provider';

const cnDetails: MatchDetail[] = [
  {
    matchId: 'CN-9001',
    championName: '亚索',
    queue: '排位单排',
    outcome: 'WIN',
    kills: 10,
    deaths: 6,
    assists: 8,
    durationMinutes: 33,
    playedAt: '2026-03-29T18:42:00.000Z',
    timelineSignals: {
      earlyDeaths: 2,
      objectiveParticipation: 0.52,
      visionScore: 24,
      csPerMinute: 7.2,
      roamingImpact: 0.69,
    },
  },
  {
    matchId: 'CN-9000',
    championName: '阿卡丽',
    queue: '排位单排',
    outcome: 'LOSS',
    kills: 7,
    deaths: 9,
    assists: 4,
    durationMinutes: 30,
    playedAt: '2026-03-28T21:15:00.000Z',
    timelineSignals: {
      earlyDeaths: 4,
      objectiveParticipation: 0.29,
      visionScore: 14,
      csPerMinute: 5.8,
      roamingImpact: 0.31,
    },
  },
  {
    matchId: 'CN-8999',
    championName: '发条魔灵',
    queue: '排位单排',
    outcome: 'WIN',
    kills: 9,
    deaths: 3,
    assists: 12,
    durationMinutes: 32,
    playedAt: '2026-03-27T20:03:00.000Z',
    timelineSignals: {
      earlyDeaths: 1,
      objectiveParticipation: 0.63,
      visionScore: 29,
      csPerMinute: 7.5,
      roamingImpact: 0.74,
    },
  },
];

const cnTimelines: Record<string, MatchTimeline> = {
  'CN-9001': {
    matchId: 'CN-9001',
    events: [
      { minute: 5, type: 'DEATH', note: '压线被抓一次' },
      { minute: 11, type: 'KILL', note: '边路支援反杀' },
      { minute: 17, type: 'OBJECTIVE', note: '拿下先锋并推塔' },
      { minute: 25, type: 'TEAMFIGHT', note: '龙魂团收割' },
    ],
  },
  'CN-9000': {
    matchId: 'CN-9000',
    events: [
      { minute: 3, type: 'DEATH', note: '一级视野不足被抓' },
      { minute: 8, type: 'DEATH', note: '河道争夺失误' },
      { minute: 16, type: 'OBJECTIVE', note: '资源团脱节' },
      { minute: 24, type: 'TEAMFIGHT', note: '开团时机过早' },
    ],
  },
  'CN-8999': {
    matchId: 'CN-8999',
    events: [
      { minute: 7, type: 'KILL', note: '中路单杀' },
      { minute: 15, type: 'OBJECTIVE', note: '控下小龙节奏' },
      { minute: 23, type: 'VISION', note: '提前布眼封锁野区' },
    ],
  },
};

export class CnMatchImportMockProvider implements MatchImportProvider {
  readonly providerId = 'cn-wegame-match-mock';
  readonly region = 'CN' as const;

  async listRecentMatches(_accountId: string, limit: number): Promise<MatchSummary[]> {
    return cnDetails.map(stripDetail).slice(0, limit);
  }

  async getMatchSummary(matchId: string): Promise<MatchSummary | undefined> {
    const detail = cnDetails.find((item) => item.matchId === matchId);
    return detail ? stripDetail(detail) : undefined;
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail | undefined> {
    return cnDetails.find((item) => item.matchId === matchId);
  }

  async getMatchTimeline(matchId: string): Promise<MatchTimeline | undefined> {
    return cnTimelines[matchId];
  }
}

function stripDetail(detail: MatchDetail): MatchSummary {
  const { timelineSignals, ...summary } = detail;
  return summary;
}
