import type { MatchDetail, MatchSummary, MatchTimeline, MatchTimelineEvent } from '../../../../domain';
import type { RiotProviderConfig } from '../../../config/game-provider-config';
import { RiotHttpClient, type RiotRegionalRouting } from '../../riot/riot-http-client';
import type { MatchImportProvider } from '../match-import.provider';

interface RiotMatchDto {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameEndTimestamp?: number;
    gameDuration: number;
    queueId: number;
    participants: Array<{
      puuid: string;
      participantId: number;
      teamId: number;
      championName: string;
      win: boolean;
      kills: number;
      deaths: number;
      assists: number;
      visionScore: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
    }>;
    teams: Array<{
      teamId: number;
      objectives: Record<string, { kills?: number }>;
    }>;
  };
}

interface RiotTimelineDto {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    frames: Array<{
      timestamp: number;
      events?: Array<{
        type: string;
        timestamp?: number;
        killerId?: number;
        victimId?: number;
        creatorId?: number;
      }>;
    }>;
  };
}

export class InternationalMatchImportRiotProvider implements MatchImportProvider {
  readonly providerId = 'intl-riot-match-real';
  readonly region = 'INTERNATIONAL' as const;

  private readonly client: RiotHttpClient;
  private readonly summaryCache = new Map<string, MatchSummary>();
  private readonly detailCache = new Map<string, MatchDetail>();
  private readonly timelineCache = new Map<string, MatchTimeline>();
  private readonly matchOwnerPuuid = new Map<string, string>();

  constructor(config: RiotProviderConfig, regionalRouting: RiotRegionalRouting) {
    this.client = new RiotHttpClient({
      config,
      regionalRouting,
    });
  }

  async listRecentMatches(accountId: string, limit: number): Promise<MatchSummary[]> {
    const boundedLimit = Math.max(1, Math.min(20, limit));
    const matchIds = await this.client.request<string[]>(
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(accountId)}/ids?start=0&count=${boundedLimit}`
    );

    const details = await Promise.all(
      matchIds.map(async (matchId) => {
        try {
          const match = await this.fetchMatch(matchId);
          const mapped = this.mapDetail(match, accountId);
          if (!mapped) return undefined;
          this.matchOwnerPuuid.set(matchId, accountId);
          this.detailCache.set(matchId, mapped);
          this.summaryCache.set(matchId, stripDetail(mapped));
          return stripDetail(mapped);
        } catch {
          return undefined;
        }
      })
    );

    return details.filter((item): item is MatchSummary => Boolean(item));
  }

  async getMatchSummary(matchId: string): Promise<MatchSummary | undefined> {
    const cached = this.summaryCache.get(matchId);
    if (cached) return cached;

    const detail = await this.getMatchDetail(matchId);
    if (!detail) return undefined;

    const summary = stripDetail(detail);
    this.summaryCache.set(matchId, summary);
    return summary;
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail | undefined> {
    const cached = this.detailCache.get(matchId);
    if (cached) return cached;

    const match = await this.fetchMatch(matchId);
    const ownerPuuid = this.matchOwnerPuuid.get(matchId);
    const mapped = this.mapDetail(match, ownerPuuid);
    if (!mapped) return undefined;

    this.detailCache.set(matchId, mapped);
    this.summaryCache.set(matchId, stripDetail(mapped));
    return mapped;
  }

  async getMatchTimeline(matchId: string): Promise<MatchTimeline | undefined> {
    const cached = this.timelineCache.get(matchId);
    if (cached) return cached;

    const match = await this.fetchMatch(matchId);
    const ownerPuuid = this.matchOwnerPuuid.get(matchId);
    const participant = this.resolveParticipant(match, ownerPuuid);
    if (!participant) return undefined;

    const timeline = await this.fetchTimeline(matchId);
    const events = this.mapTimelineEvents(timeline, participant.participantId);
    const mapped: MatchTimeline = {
      matchId,
      events,
    };
    this.timelineCache.set(matchId, mapped);
    return mapped;
  }

  private async fetchMatch(matchId: string): Promise<RiotMatchDto> {
    return this.client.request<RiotMatchDto>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
  }

  private async fetchTimeline(matchId: string): Promise<RiotTimelineDto> {
    return this.client.request<RiotTimelineDto>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`);
  }

  private resolveParticipant(
    match: RiotMatchDto,
    preferredPuuid?: string
  ): RiotMatchDto['info']['participants'][number] | undefined {
    if (preferredPuuid) {
      const owner = match.info.participants.find((item) => item.puuid === preferredPuuid);
      if (owner) return owner;
    }

    const firstPuuid = match.metadata.participants[0];
    if (firstPuuid) {
      const first = match.info.participants.find((item) => item.puuid === firstPuuid);
      if (first) return first;
    }

    return match.info.participants[0];
  }

  private mapDetail(match: RiotMatchDto, preferredPuuid?: string): MatchDetail | undefined {
    const participant = this.resolveParticipant(match, preferredPuuid);
    if (!participant) return undefined;

    const durationMinutes = normalizeDurationMinutes(match.info.gameDuration);
    const teamKills = this.resolveTeamKills(match, participant.teamId);
    const objectiveParticipation = teamKills > 0 ? clamp((participant.kills + participant.assists) / teamKills) : 0;
    const csPerMinute = durationMinutes > 0
      ? Number(((participant.totalMinionsKilled + participant.neutralMinionsKilled) / durationMinutes).toFixed(2))
      : 0;
    const roamingImpact = clamp((participant.assists + Math.max(0, participant.kills - participant.deaths)) / 20);

    return {
      matchId: match.metadata.matchId,
      championName: participant.championName,
      queue: queueLabel(match.info.queueId),
      outcome: participant.win ? 'WIN' : 'LOSS',
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      durationMinutes,
      playedAt: new Date(match.info.gameEndTimestamp ?? match.info.gameCreation).toISOString(),
      timelineSignals: {
        earlyDeaths: 0,
        objectiveParticipation,
        visionScore: participant.visionScore,
        csPerMinute,
        roamingImpact,
      },
    };
  }

  private resolveTeamKills(match: RiotMatchDto, teamId: number): number {
    const team = match.info.teams.find((item) => item.teamId === teamId);
    if (!team) return 0;
    return team.objectives?.champion?.kills ?? 0;
  }

  private mapTimelineEvents(timeline: RiotTimelineDto, participantId: number): MatchTimelineEvent[] {
    const mapped: MatchTimelineEvent[] = [];

    for (const frame of timeline.info.frames) {
      for (const event of frame.events ?? []) {
        const type = this.toEventType(event.type, participantId, event);
        if (!type) continue;

        const sourceTimestamp = event.timestamp ?? frame.timestamp;
        mapped.push({
          minute: Math.floor(sourceTimestamp / 60000),
          type,
          note: this.eventNote(type),
        });
      }
    }

    return mapped.slice(0, 30);
  }

  private toEventType(
    eventType: string,
    participantId: number,
    event: { killerId?: number; victimId?: number; creatorId?: number }
  ): MatchTimelineEvent['type'] | undefined {
    if (eventType === 'CHAMPION_KILL' && event.victimId === participantId) return 'DEATH';
    if (eventType === 'CHAMPION_KILL' && event.killerId === participantId) return 'KILL';
    if ((eventType === 'ELITE_MONSTER_KILL' || eventType === 'BUILDING_KILL') && event.killerId === participantId) {
      return 'OBJECTIVE';
    }
    if ((eventType === 'WARD_PLACED' || eventType === 'WARD_KILL') && (event.creatorId === participantId || event.killerId === participantId)) {
      return 'VISION';
    }
    return undefined;
  }

  private eventNote(type: MatchTimelineEvent['type']): string {
    if (type === 'DEATH') return '关键阵亡';
    if (type === 'KILL') return '关键击杀';
    if (type === 'OBJECTIVE') return '参与资源争夺';
    if (type === 'VISION') return '视野博弈';
    return '团战节点';
  }
}

function normalizeDurationMinutes(rawDuration: number): number {
  if (rawDuration <= 0) return 0;
  const seconds = rawDuration > 100000 ? rawDuration / 1000 : rawDuration;
  return Math.max(1, Math.round(seconds / 60));
}

function stripDetail(detail: MatchDetail): MatchSummary {
  const { timelineSignals, ...summary } = detail;
  return summary;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(2));
}

function queueLabel(queueId: number): string {
  const mapping: Record<number, string> = {
    400: '匹配模式',
    420: '单双排位',
    430: '人机模式',
    440: '灵活排位',
    450: '极地大乱斗',
    490: '快速模式',
    700: '极限闪击',
    900: '无限火力',
    1700: '斗魂竞技场',
  };
  return mapping[queueId] ?? `模式 ${queueId}`;
}

