import type { MatchDetail, MatchSummary, Region } from '../../domain';

const matchDataByRegion: Record<Region, MatchDetail[]> = {
  INTERNATIONAL: [
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
  ],
  CN: [
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
  ],
};

export class MockMatchRepository {
  async listRecent(region: Region): Promise<MatchSummary[]> {
    return matchDataByRegion[region].map(({ timelineSignals, ...summary }) => summary);
  }

  async listDetails(region: Region): Promise<MatchDetail[]> {
    return matchDataByRegion[region];
  }

  async getById(region: Region, matchId: string): Promise<MatchDetail | undefined> {
    return matchDataByRegion[region].find((match) => match.matchId === matchId);
  }

  async getLatest(region: Region): Promise<MatchDetail | undefined> {
    return matchDataByRegion[region][0];
  }
}
