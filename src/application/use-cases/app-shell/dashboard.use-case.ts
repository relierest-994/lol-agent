import { callBackendApi } from '../../http-api.client';
import type { MatchDetail, MatchTimeline, Region } from '../../../domain';

export type ChangeTag = 'BUFF' | 'NERF' | 'NEUTRAL';

export interface HomeVersionUpdate {
  id: string;
  title: string;
  detail: string;
  patch: string;
  publishedAt: string;
  source: 'DATA_DRAGON_LLM' | 'DATA_DRAGON_RULE';
}

export interface HomeDashboardResponse {
  latestVersion: string;
  previousVersion?: string;
  updates: HomeVersionUpdate[];
  spotlight: string[];
  sourceNotice: string;
  generatedAt: string;
}

export interface DataCenterResponse {
  stats: {
    recentWinRate: number;
    rankTrend: 'UP' | 'DOWN' | 'FLAT';
    wins: number;
    losses: number;
    kda: string;
  };
  charts: {
    winRateTrend: number[];
    kdaTrend: number[];
    killsTrend: number[];
    deathsTrend: number[];
  };
  narrative: string;
  keyInsights: string[];
}

export type HeroPosition = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ALL';

export interface HeroListItem {
  championId: string;
  name: string;
  title: string;
  avatarUrl: string;
  positions: HeroPosition[];
  latestChangeTag: ChangeTag;
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
  cooldown?: string;
  cost?: string;
  range?: string;
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
    latestChangeTag: ChangeTag;
    latestChangeSummary: string;
    stats: Record<string, number>;
    passive: HeroSpellDetail;
    spells: HeroSpellDetail[];
  };
  sourceNotice: string;
}

export interface ItemListItem {
  itemId: string;
  name: string;
  plainText: string;
  iconUrl: string;
  latestChangeTag: ChangeTag;
  latestChangeSummary: string;
}

export interface ItemListResponse {
  version: string;
  previousVersion?: string;
  items: ItemListItem[];
  sourceNotice: string;
}

export interface ItemDetailResponse {
  version: string;
  previousVersion?: string;
  item: {
    itemId: string;
    name: string;
    plainText: string;
    description: string;
    iconUrl: string;
    goldTotal: number;
    goldSell: number;
    tags: string[];
    stats: Record<string, number>;
    latestChangeTag: ChangeTag;
    latestChangeSummary: string;
  };
  sourceNotice: string;
}

export interface RuneListItem {
  runeId: string;
  key: string;
  name: string;
  tree: string;
  iconUrl: string;
  latestChangeTag: ChangeTag;
  latestChangeSummary: string;
}

export interface RuneListResponse {
  version: string;
  previousVersion?: string;
  runes: RuneListItem[];
  sourceNotice: string;
}

export interface RuneDetailResponse {
  version: string;
  previousVersion?: string;
  rune: {
    runeId: string;
    key: string;
    name: string;
    tree: string;
    iconUrl: string;
    shortDesc: string;
    longDesc: string;
    latestChangeTag: ChangeTag;
    latestChangeSummary: string;
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

export async function getHeroesUseCase(input: {
  userId: string;
  position?: HeroPosition;
  changeTag?: 'ALL' | ChangeTag;
}): Promise<HeroListResponse> {
  const position = input.position ?? 'ALL';
  const changeTag = input.changeTag ?? 'ALL';
  return callBackendApi<HeroListResponse>({
    path: `app/heroes?user_id=${encodeURIComponent(input.userId)}&position=${encodeURIComponent(position)}&change_tag=${encodeURIComponent(changeTag)}`,
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

export async function getItemsUseCase(input: { userId: string; changeTag?: 'ALL' | ChangeTag }): Promise<ItemListResponse> {
  const changeTag = input.changeTag ?? 'ALL';
  return callBackendApi<ItemListResponse>({
    path: `app/items?user_id=${encodeURIComponent(input.userId)}&change_tag=${encodeURIComponent(changeTag)}`,
  });
}

export async function getItemDetailUseCase(input: { userId: string; itemId: string }): Promise<ItemDetailResponse> {
  return callBackendApi<ItemDetailResponse>({
    path: `app/items/${encodeURIComponent(input.itemId)}?user_id=${encodeURIComponent(input.userId)}`,
  });
}

export async function getRunesUseCase(input: { userId: string; changeTag?: 'ALL' | ChangeTag }): Promise<RuneListResponse> {
  const changeTag = input.changeTag ?? 'ALL';
  return callBackendApi<RuneListResponse>({
    path: `app/runes?user_id=${encodeURIComponent(input.userId)}&change_tag=${encodeURIComponent(changeTag)}`,
  });
}

export async function getRuneDetailUseCase(input: { userId: string; runeId: string }): Promise<RuneDetailResponse> {
  return callBackendApi<RuneDetailResponse>({
    path: `app/runes/${encodeURIComponent(input.runeId)}?user_id=${encodeURIComponent(input.userId)}`,
  });
}

export async function getMatchDetailForAppUseCase(input: {
  region: Region;
  matchId: string;
}): Promise<{ detail?: MatchDetail; timeline?: MatchTimeline }> {
  const detail = await callBackendApi<MatchDetail | null>({
    path: `matches/${encodeURIComponent(input.matchId)}?region=${encodeURIComponent(input.region)}`,
  });
  const timeline = await callBackendApi<MatchTimeline | null>({
    path: `matches/${encodeURIComponent(input.matchId)}/timeline?region=${encodeURIComponent(input.region)}`,
  });
  return { detail: detail ?? undefined, timeline: timeline ?? undefined };
}
