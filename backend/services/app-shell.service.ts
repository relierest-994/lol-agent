import type { CapabilityProvider } from '../../src/capabilities/toolkit';
import type { MatchSummary, Region } from '../../src/domain';
import { createPersistentStateStore } from '../../src/infrastructure/persistence/persistent-state.store';
import { execPsql } from '../db/psql-client';

const PHONE_REGEX = /^1\d{10}$/;
const DEFAULT_AVATAR_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg';

interface AppUserRecord {
  userId: string;
  phone: string;
  nickname?: string;
  avatarUrl: string;
  profileCompleted: boolean;
  createdAt: string;
  lastLoginAt: string;
}

interface AppLoginCodeRecord {
  requestId: string;
  phone: string;
  code: string;
  expiresAt: string;
  consumed: boolean;
  createdAt: string;
}

interface AppShellState {
  usersById: Record<string, AppUserRecord>;
  phoneToUserId: Record<string, string>;
  loginCodesByPhone: Record<string, AppLoginCodeRecord>;
  sessions: Record<string, { userId: string; createdAt: string }>;
}

interface HomeVersionUpdate {
  id: string;
  title: string;
  detail: string;
  patch: string;
  publishedAt: string;
  source: 'MOCK_RIOT_FEED';
}

type HeroPosition = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ALL';
type HeroChangeTag = 'BUFF' | 'NERF' | 'NEUTRAL';

interface HeroListItem {
  championId: string;
  name: string;
  title: string;
  avatarUrl: string;
  positions: HeroPosition[];
  latestChangeTag: HeroChangeTag;
  latestChangeSummary: string;
}

interface HeroListResponse {
  version: string;
  previousVersion?: string;
  positions: HeroPosition[];
  champions: HeroListItem[];
  sourceNotice: string;
}

interface HeroSpellDetail {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
}

interface HeroDetailResponse {
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

interface DataDragonImage {
  full: string;
}

interface DataDragonSpell {
  id: string;
  name: string;
  description: string;
  image: DataDragonImage;
}

interface DataDragonPassive {
  name: string;
  description: string;
  image: DataDragonImage;
}

interface DataDragonStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  armor: number;
  armorperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
}

interface DataDragonChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  lore?: string;
  blurb?: string;
  tags: string[];
  image: DataDragonImage;
  stats: DataDragonStats;
  passive?: DataDragonPassive;
  spells?: DataDragonSpell[];
}

interface DataDragonChampionsPayload {
  data: Record<string, DataDragonChampion>;
}

function createInitialState(): AppShellState {
  return {
    usersById: {},
    phoneToUserId: {},
    loginCodesByPhone: {},
    sessions: {},
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function normalizeState(input: unknown): AppShellState {
  const raw = asRecord(input);
  return {
    usersById: asRecord(raw.usersById) as Record<string, AppUserRecord>,
    phoneToUserId: asRecord(raw.phoneToUserId) as Record<string, string>,
    loginCodesByPhone: asRecord(raw.loginCodesByPhone) as Record<string, AppLoginCodeRecord>,
    sessions: asRecord(raw.sessions) as Record<string, { userId: string; createdAt: string }>,
  };
}

function normalizePhone(input: string): string {
  return input.trim();
}

function validatePhone(phone: string): void {
  if (!PHONE_REGEX.test(phone)) {
    throw new Error('INVALID_PHONE_NUMBER');
  }
}

function randomDigits(length: number): string {
  const chars = '0123456789';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function safeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function safeSqlNullable(value: string | undefined): string {
  if (value === undefined) return 'NULL';
  return safeSqlString(value);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function getDbSchema(): string {
  return process.env.APP_DB_SCHEMA?.trim() || 'public';
}

function appShellTable(tableName: string): string {
  return `${quoteIdentifier(getDbSchema())}.${quoteIdentifier(tableName)}`;
}

function parseJsonRows<T>(raw: string): T[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatKda(matches: MatchSummary[]): string {
  if (matches.length === 0) return '0.00';
  const kills = matches.reduce((sum, item) => sum + item.kills, 0);
  const assists = matches.reduce((sum, item) => sum + item.assists, 0);
  const deaths = matches.reduce((sum, item) => sum + item.deaths, 0);
  const score = (kills + assists) / Math.max(1, deaths);
  return score.toFixed(2);
}

function trendFromWinRate(winRate: number): 'UP' | 'DOWN' | 'FLAT' {
  if (winRate >= 0.56) return 'UP';
  if (winRate <= 0.45) return 'DOWN';
  return 'FLAT';
}

function mapTagsToPositions(tags: string[]): HeroPosition[] {
  const normalized = tags.map((item) => item.toLowerCase());
  const mapped = new Set<HeroPosition>();
  if (normalized.some((item) => item.includes('fighter') || item.includes('tank'))) mapped.add('TOP');
  if (normalized.some((item) => item.includes('assassin') || item.includes('fighter'))) mapped.add('JUNGLE');
  if (normalized.some((item) => item.includes('mage') || item.includes('assassin'))) mapped.add('MID');
  if (normalized.some((item) => item.includes('marksman'))) mapped.add('ADC');
  if (normalized.some((item) => item.includes('support') || item.includes('mage') || item.includes('tank'))) mapped.add('SUPPORT');
  if (mapped.size === 0) mapped.add('MID');
  return [...mapped];
}

function inferChampionChangeTag(
  current: DataDragonChampion,
  previous?: DataDragonChampion
): { tag: HeroChangeTag; summary: string } {
  if (!previous) {
    return {
      tag: 'NEUTRAL',
      summary: '暂无上一版本对比数据',
    };
  }

  const score =
    (current.stats.attackdamage - previous.stats.attackdamage) * 2 +
    (current.stats.attackdamageperlevel - previous.stats.attackdamageperlevel) * 8 +
    (current.stats.hp - previous.stats.hp) * 0.06 +
    (current.stats.hpperlevel - previous.stats.hpperlevel) * 1.2 +
    (current.stats.armor - previous.stats.armor) * 1.5 +
    (current.stats.armorperlevel - previous.stats.armorperlevel) * 7 +
    (current.stats.mp - previous.stats.mp) * 0.03 +
    (current.stats.mpperlevel - previous.stats.mpperlevel) * 0.8;

  if (score >= 2.4) {
    return { tag: 'BUFF', summary: '对比上一版本基础属性有上调（推断）' };
  }
  if (score <= -2.4) {
    return { tag: 'NERF', summary: '对比上一版本基础属性有下调（推断）' };
  }
  return { tag: 'NEUTRAL', summary: '对比上一版本变动较小或方向不明显（推断）' };
}

export class AppShellService {
  private readonly store = createPersistentStateStore('app-shell-v2');
  private readonly dbModeEnabled: boolean;
  private dbWriteAvailable = true;
  private dbTablesReady = false;
  private heroCache?: {
    cachedAt: number;
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentChampions: Record<string, DataDragonChampion>;
    previousChampions: Record<string, DataDragonChampion>;
  };

  constructor(private readonly provider: CapabilityProvider, runtimeMode: 'mock' | 'db') {
    this.dbModeEnabled = runtimeMode === 'db';
  }

  private readState(): AppShellState {
    const raw = this.store.read<unknown>('state');
    if (!raw) return createInitialState();
    return normalizeState(raw);
  }

  private writeState(state: AppShellState): void {
    this.store.write('state', normalizeState(state));
  }

  private ensureAppShellTables(): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable || this.dbTablesReady) return;
    execPsql(`
      CREATE TABLE IF NOT EXISTS ${appShellTable('app_users')} (
        user_id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        nickname TEXT,
        avatar_url TEXT NOT NULL,
        profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        last_login_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ${appShellTable('app_login_codes')} (
        request_id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        verification_code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ${appShellTable('app_user_sessions')} (
        session_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ${appShellTable('app_user_game_accounts')} (
        user_id TEXT NOT NULL,
        region TEXT NOT NULL,
        account_id TEXT NOT NULL,
        game_name TEXT NOT NULL,
        tag_line TEXT NOT NULL,
        last_synced_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, region)
      );
    `);
    this.dbTablesReady = true;
  }

  private persistUserToDb(user: AppUserRecord): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      execPsql(`
        INSERT INTO ${appShellTable('app_users')} (
          user_id,
          phone,
          nickname,
          avatar_url,
          profile_completed,
          created_at,
          last_login_at
        ) VALUES (
          ${safeSqlString(user.userId)},
          ${safeSqlString(user.phone)},
          ${safeSqlNullable(user.nickname)},
          ${safeSqlString(user.avatarUrl)},
          ${user.profileCompleted ? 'TRUE' : 'FALSE'},
          ${safeSqlString(user.createdAt)}::timestamptz,
          ${safeSqlString(user.lastLoginAt)}::timestamptz
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          phone = EXCLUDED.phone,
          nickname = EXCLUDED.nickname,
          avatar_url = EXCLUDED.avatar_url,
          profile_completed = EXCLUDED.profile_completed,
          last_login_at = EXCLUDED.last_login_at,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  private persistCodeToDb(code: AppLoginCodeRecord): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      execPsql(`
        INSERT INTO ${appShellTable('app_login_codes')} (
          request_id,
          phone,
          verification_code,
          expires_at,
          consumed,
          created_at
        ) VALUES (
          ${safeSqlString(code.requestId)},
          ${safeSqlString(code.phone)},
          ${safeSqlString(code.code)},
          ${safeSqlString(code.expiresAt)}::timestamptz,
          ${code.consumed ? 'TRUE' : 'FALSE'},
          ${safeSqlString(code.createdAt)}::timestamptz
        )
        ON CONFLICT (request_id)
        DO UPDATE SET
          verification_code = EXCLUDED.verification_code,
          expires_at = EXCLUDED.expires_at,
          consumed = EXCLUDED.consumed,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  private persistSessionToDb(sessionToken: string, userId: string, createdAt: string): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      execPsql(`
        INSERT INTO ${appShellTable('app_user_sessions')} (
          session_token,
          user_id,
          created_at,
          updated_at
        ) VALUES (
          ${safeSqlString(sessionToken)},
          ${safeSqlString(userId)},
          ${safeSqlString(createdAt)}::timestamptz,
          ${safeSqlString(createdAt)}::timestamptz
        )
        ON CONFLICT (session_token)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  private persistGameAccountToDb(input: {
    userId: string;
    region: Region;
    accountId: string;
    gameName: string;
    tagLine: string;
    nowIso: string;
  }): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      execPsql(`
        INSERT INTO ${appShellTable('app_user_game_accounts')} (
          user_id,
          region,
          account_id,
          game_name,
          tag_line,
          last_synced_at,
          created_at,
          updated_at
        ) VALUES (
          ${safeSqlString(input.userId)},
          ${safeSqlString(input.region)},
          ${safeSqlString(input.accountId)},
          ${safeSqlString(input.gameName)},
          ${safeSqlString(input.tagLine)},
          ${safeSqlString(input.nowIso)}::timestamptz,
          ${safeSqlString(input.nowIso)}::timestamptz,
          ${safeSqlString(input.nowIso)}::timestamptz
        )
        ON CONFLICT (user_id, region)
        DO UPDATE SET
          account_id = EXCLUDED.account_id,
          game_name = EXCLUDED.game_name,
          tag_line = EXCLUDED.tag_line,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  async sendLoginCode(phoneRaw: string): Promise<{ requestId: string; expiresAt: string; mockCodeHint: string }> {
    const phone = normalizePhone(phoneRaw);
    validatePhone(phone);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const code = randomDigits(6);

    const state = this.readState();
    const record: AppLoginCodeRecord = {
      requestId,
      phone,
      code,
      expiresAt,
      consumed: false,
      createdAt: now.toISOString(),
    };
    state.loginCodesByPhone[phone] = record;
    this.writeState(state);
    this.persistCodeToDb(record);

    return {
      requestId,
      expiresAt,
      mockCodeHint: code,
    };
  }

  async loginWithCode(input: { phoneRaw: string; verificationCode: string }): Promise<{
    sessionToken: string;
    isNewUser: boolean;
    profile: AppUserRecord;
  }> {
    const phone = normalizePhone(input.phoneRaw);
    validatePhone(phone);

    const state = this.readState();
    const codeRecord = state.loginCodesByPhone[phone];
    if (!codeRecord) {
      throw new Error('VERIFICATION_CODE_REQUIRED');
    }

    const now = new Date().toISOString();
    if (new Date(codeRecord.expiresAt).getTime() < Date.now()) {
      throw new Error('VERIFICATION_CODE_EXPIRED');
    }
    if (codeRecord.consumed) {
      throw new Error('VERIFICATION_CODE_USED');
    }
    if (codeRecord.code !== input.verificationCode.trim()) {
      throw new Error('VERIFICATION_CODE_INVALID');
    }

    const existingId = state.phoneToUserId[phone];
    const isNewUser = !existingId;
    const userId = existingId ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const existing = state.usersById[userId];
    const profile: AppUserRecord = {
      userId,
      phone,
      nickname: existing?.nickname,
      avatarUrl: existing?.avatarUrl ?? DEFAULT_AVATAR_URL,
      profileCompleted: existing?.profileCompleted ?? false,
      createdAt: existing?.createdAt ?? now,
      lastLoginAt: now,
    };

    codeRecord.consumed = true;
    state.usersById[userId] = profile;
    state.phoneToUserId[phone] = userId;

    const sessionToken = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    state.sessions[sessionToken] = { userId, createdAt: now };

    this.writeState(state);
    this.persistUserToDb(profile);
    this.persistCodeToDb(codeRecord);
    this.persistSessionToDb(sessionToken, userId, now);

    return {
      sessionToken,
      isNewUser,
      profile,
    };
  }

  async setupProfile(input: { userId: string; nickname: string; avatarUrl?: string }): Promise<AppUserRecord> {
    const nickname = input.nickname.trim();
    if (!nickname) throw new Error('NICKNAME_REQUIRED');

    const state = this.readState();
    const profile = state.usersById[input.userId];
    if (!profile) throw new Error('APP_USER_NOT_FOUND');

    const updated: AppUserRecord = {
      ...profile,
      nickname,
      avatarUrl: input.avatarUrl?.trim() || profile.avatarUrl || DEFAULT_AVATAR_URL,
      profileCompleted: true,
    };

    state.usersById[input.userId] = updated;
    this.writeState(state);
    this.persistUserToDb(updated);

    return updated;
  }

  async getProfile(userId: string): Promise<AppUserRecord | undefined> {
    const state = this.readState();
    return state.usersById[userId];
  }

  async getHomeDashboard(_userId: string): Promise<{ updates: HomeVersionUpdate[]; sourceNotice: string }> {
    const updates: HomeVersionUpdate[] = [
      {
        id: 'patch-14.24',
        title: '14.24 平衡性调整摘要',
        detail: '刺客装备小幅回调，打野节奏更偏向前中期控图，射手前两件成型窗口延后。',
        patch: '14.24',
        publishedAt: '2026-03-25T10:00:00.000Z',
        source: 'MOCK_RIOT_FEED',
      },
      {
        id: 'patch-14.23b',
        title: '14.23b 热修复要点',
        detail: '上路雪球英雄被削弱，团战型中单容错提升，先锋收益小幅下降。',
        patch: '14.23b',
        publishedAt: '2026-03-18T09:00:00.000Z',
        source: 'MOCK_RIOT_FEED',
      },
      {
        id: 'dev-blog-pace',
        title: '开发者日志：中期节奏与资源博弈',
        detail: '官方强调 12-20 分钟视野优先级，建议队伍围绕二先锋和龙魂点建立先手。',
        patch: 'DEV-BLOG',
        publishedAt: '2026-03-12T08:30:00.000Z',
        source: 'MOCK_RIOT_FEED',
      },
    ];

    return {
      updates,
      sourceNotice: '当前版本变动为 Mock Riot Feed（阶段内未接入正式 Riot 新闻 API）。',
    };
  }

  async getDataCenter(userId: string): Promise<{
    stats: {
      recentWinRate: number;
      rankTrend: 'UP' | 'DOWN' | 'FLAT';
      wins: number;
      losses: number;
      kda: string;
    };
    narrative: string;
  }> {
    const regions: Region[] = ['INTERNATIONAL', 'CN'];
    let linkedAccount: Awaited<ReturnType<CapabilityProvider['getLinkedAccount']>>;
    let linkedRegion: Region = 'INTERNATIONAL';

    for (const region of regions) {
      const account = await this.provider.getLinkedAccount(userId, region);
      if (account) {
        linkedAccount = account;
        linkedRegion = region;
        break;
      }
    }

    if (!linkedAccount) {
      return {
        stats: {
          recentWinRate: 0,
          rankTrend: 'FLAT',
          wins: 0,
          losses: 0,
          kda: '0.00',
        },
        narrative: '绑定游戏账号后，即可看到你的最近胜率、段位变化和训练趋势。',
      };
    }

    this.persistGameAccountToDb({
      userId,
      region: linkedRegion,
      accountId: linkedAccount.accountId,
      gameName: linkedAccount.gameName,
      tagLine: linkedAccount.tagLine,
      nowIso: new Date().toISOString(),
    });

    const recent = await this.provider.listRecentMatches(linkedRegion, linkedAccount.accountId, 10);
    const summaries = recent.summaries;
    const wins = summaries.filter((item) => item.outcome === 'WIN').length;
    const losses = summaries.length - wins;
    const winRate = summaries.length > 0 ? wins / summaries.length : 0;
    const trend = trendFromWinRate(winRate);
    const kda = formatKda(summaries);

    const narrative =
      trend === 'UP'
        ? `经电竞私教指导后，你最近 ${summaries.length} 局胜率明显提升，段位趋势向上。继续保持对中期资源点的提前站位。`
        : trend === 'DOWN'
          ? '最近对局胜率有下滑，建议优先复盘中期转线和资源团决策，先稳住节奏。'
          : '近期状态比较稳定，建议把复盘重点放在高代价死亡和关键资源前的视野布局。';

    return {
      stats: {
        recentWinRate: Number((winRate * 100).toFixed(1)),
        rankTrend: trend,
        wins,
        losses,
        kda,
      },
      narrative,
    };
  }

  async getHeroesDashboard(input: { position?: HeroPosition }): Promise<HeroListResponse> {
    const snapshot = await this.loadHeroSnapshot();
    const targetPosition = input.position ?? 'ALL';
    const positions: HeroPosition[] = ['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

    const champions = Object.values(snapshot.currentChampions)
      .map((champion) => {
        const previous = snapshot.previousChampions[champion.id];
        const change = inferChampionChangeTag(champion, previous);
        const heroPositions = mapTagsToPositions(champion.tags);
        return {
          championId: champion.id,
          name: champion.name,
          title: champion.title,
          avatarUrl: `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/champion/${champion.image.full}`,
          positions: heroPositions,
          latestChangeTag: change.tag,
          latestChangeSummary: change.summary,
        } as HeroListItem;
      })
      .filter((item) => targetPosition === 'ALL' || item.positions.includes(targetPosition))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      positions,
      champions,
      sourceNotice: snapshot.sourceNotice,
    };
  }

  async getHeroDetail(input: { championId: string }): Promise<HeroDetailResponse | undefined> {
    const snapshot = await this.loadHeroSnapshot();
    const champion = snapshot.currentChampions[input.championId];
    if (!champion) return undefined;

    const previous = snapshot.previousChampions[champion.id];
    const change = inferChampionChangeTag(champion, previous);
    const avatarUrl = `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/champion/${champion.image.full}`;
    const passiveRaw = champion.passive;
    const passive: HeroSpellDetail = {
      id: `${champion.id}-passive`,
      name: passiveRaw?.name ?? '被动技能',
      description: passiveRaw?.description ?? '暂无被动技能说明',
      iconUrl: passiveRaw?.image?.full
        ? `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/passive/${passiveRaw.image.full}`
        : avatarUrl,
    };
    const spellsRaw = Array.isArray(champion.spells) ? champion.spells : [];
    const spells: HeroSpellDetail[] = spellsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/spell/${item.image.full}`,
    }));

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      champion: {
        championId: champion.id,
        name: champion.name,
        title: champion.title,
        lore: champion.lore ?? champion.blurb ?? '暂无英雄背景故事',
        avatarUrl,
        positions: mapTagsToPositions(champion.tags),
        latestChangeTag: change.tag,
        latestChangeSummary: change.summary,
        passive,
        spells,
      },
      sourceNotice: snapshot.sourceNotice,
    };
  }

  private async loadHeroSnapshot(): Promise<{
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentChampions: Record<string, DataDragonChampion>;
    previousChampions: Record<string, DataDragonChampion>;
  }> {
    const now = Date.now();
    if (this.heroCache && now - this.heroCache.cachedAt < 10 * 60 * 1000) {
      return this.heroCache;
    }

    try {
      const versionResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      if (!versionResponse.ok) throw new Error(`VERSIONS_FETCH_FAILED_${versionResponse.status}`);
      const versions = (await versionResponse.json()) as string[];
      const version = versions[0];
      const previousVersion = versions[1];
      if (!version) throw new Error('VERSIONS_EMPTY');

      const currentPayload = await this.fetchChampionPayload(version);
      const previousPayload = previousVersion ? await this.fetchChampionPayload(previousVersion) : undefined;

      const snapshot = {
        cachedAt: now,
        version,
        previousVersion,
        sourceNotice:
          '英雄数据来源于 Data Dragon（官方静态 CDN）。增强/削弱标签为当前版本与上一版本基础属性对比推断，非官方显式结论。',
        currentChampions: currentPayload.data,
        previousChampions: previousPayload?.data ?? {},
      };
      this.heroCache = snapshot;
      return snapshot;
    } catch {
      const fallbackVersion = '14.24.1';
      const fallbackPayload = await this.fetchChampionPayload(fallbackVersion);
      const snapshot = {
        cachedAt: now,
        version: fallbackVersion,
        previousVersion: undefined,
        sourceNotice:
          '当前未能获取最新版本列表，已降级为固定版本英雄数据。增强/削弱标签不可用，统一按中性展示。',
        currentChampions: fallbackPayload.data,
        previousChampions: {},
      };
      this.heroCache = snapshot;
      return snapshot;
    }
  }

  private async fetchChampionPayload(version: string): Promise<DataDragonChampionsPayload> {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/champion.json`);
    if (!response.ok) throw new Error(`CHAMPION_FETCH_FAILED_${response.status}`);
    return (await response.json()) as DataDragonChampionsPayload;
  }

  async seedFromDb(): Promise<void> {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      const userRows = parseJsonRows<{
        user_id: string;
        phone: string;
        nickname: string | null;
        avatar_url: string;
        profile_completed: boolean;
        created_at: string;
        last_login_at: string;
      }>(
        execPsql(`
          SELECT user_id, phone, nickname, avatar_url, profile_completed, created_at::text, last_login_at::text
          FROM ${appShellTable('app_users')};
        `)
      );

      const state = this.readState();
      for (const row of userRows) {
        state.usersById[row.user_id] = {
          userId: row.user_id,
          phone: row.phone,
          nickname: row.nickname ?? undefined,
          avatarUrl: row.avatar_url,
          profileCompleted: row.profile_completed,
          createdAt: row.created_at,
          lastLoginAt: row.last_login_at,
        };
        state.phoneToUserId[row.phone] = row.user_id;
      }
      this.writeState(state);
    } catch {
      this.dbWriteAvailable = false;
    }
  }
}

export type { AppUserRecord };

