import { callBackendApi } from '../../http-api.client';

export interface HomeVersionUpdate {
  id: string;
  title: string;
  detail: string;
  patch: string;
  publishedAt: string;
  source: 'MOCK_RIOT_FEED';
}

export interface HomeDashboardResponse {
  updates: HomeVersionUpdate[];
  sourceNotice: string;
}

export interface DataCenterResponse {
  stats: {
    recentWinRate: number;
    rankTrend: 'UP' | 'DOWN' | 'FLAT';
    wins: number;
    losses: number;
    kda: string;
  };
  narrative: string;
}

export type HeroPosition = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ALL';

export type HeroChangeTag = 'BUFF' | 'NERF' | 'NEUTRAL';

export interface HeroListItem {
  championId: string;
  name: string;
  title: string;
  avatarUrl: string;
  positions: HeroPosition[];
  latestChangeTag: HeroChangeTag;
  latestChangeSummary: string;
}

export interface HeroListResponse {
  version: string;
  previousVersion?: string;
  positions: HeroPosition[];
  champions: HeroListItem[];
  sourceNotice: string;
}

export interface HeroSpellDetail {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
}

export interface HeroDetailResponse {
  version: string;
  previousVersion?: string;
  champion: {
    championId: string;
    name: string;
    title: string;
    lore: string;
    avatarUrl: string;
    positions: HeroPosition[];
    latestChangeTag: HeroChangeTag;
    latestChangeSummary: string;
    passive: HeroSpellDetail;
    spells: HeroSpellDetail[];
  };
  sourceNotice: string;
}

export async function getHomeDashboardUseCase(userId: string): Promise<HomeDashboardResponse> {
  return callBackendApi<HomeDashboardResponse>({
    path: `app/dashboard/home?user_id=${encodeURIComponent(userId)}`,
  });
}

export async function getDataCenterUseCase(userId: string): Promise<DataCenterResponse> {
  return callBackendApi<DataCenterResponse>({
    path: `app/dashboard/data-center?user_id=${encodeURIComponent(userId)}`,
  });
}

export async function getHeroesUseCase(input: { userId: string; position?: HeroPosition }): Promise<HeroListResponse> {
  const position = input.position ?? 'ALL';
  return callBackendApi<HeroListResponse>({
    path: `app/heroes?user_id=${encodeURIComponent(input.userId)}&position=${encodeURIComponent(position)}`,
  });
}

export async function getHeroDetailUseCase(input: {
  userId: string;
  championId: string;
}): Promise<HeroDetailResponse> {
  return callBackendApi<HeroDetailResponse>({
    path: `app/heroes/${encodeURIComponent(input.championId)}?user_id=${encodeURIComponent(input.userId)}`,
  });
}

