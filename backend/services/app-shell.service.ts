import type { CapabilityProvider } from '../../src/capabilities/toolkit';
import type { MatchSummary, Region } from '../../src/domain';
import { loadRuntimeConfig } from '../../src/infrastructure/config/runtime-config';
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
  source: 'DATA_DRAGON_LLM' | 'DATA_DRAGON_RULE';
}

interface HomeInsightItem {
  championId: string;
  championName: string;
  avatarUrl: string;
  summary: string;
}

interface HomeHeroChangeItem {
  championId: string;
  championName: string;
  avatarUrl: string;
  statDelta: string;
  skillDelta?: string;
}

interface HomeItemChangeItem {
  itemId: string;
  itemName: string;
  iconUrl: string;
  changeSummary: string;
}

interface HomeRuneChangeItem {
  runeId: string;
  runeName: string;
  iconUrl: string;
  changeSummary: string;
}

interface HomeVersionReport {
  heroChanges: HomeHeroChangeItem[];
  itemChanges: HomeItemChangeItem[];
  runeChanges: HomeRuneChangeItem[];
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
  cooldown?: string;
  cost?: string;
  range?: string;
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
    stats: Record<string, number>;
    passive: HeroSpellDetail;
    spells: HeroSpellDetail[];
  };
  sourceNotice: string;
}

interface ItemListItem {
  itemId: string;
  name: string;
  plainText: string;
  iconUrl: string;
  latestChangeTag: HeroChangeTag;
  latestChangeSummary: string;
}

interface ItemListResponse {
  version: string;
  previousVersion?: string;
  items: ItemListItem[];
  sourceNotice: string;
}

interface ItemDetailResponse {
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
    latestChangeTag: HeroChangeTag;
    latestChangeSummary: string;
  };
  sourceNotice: string;
}

interface RuneListItem {
  runeId: string;
  key: string;
  name: string;
  tree: string;
  iconUrl: string;
  latestChangeTag: HeroChangeTag;
  latestChangeSummary: string;
}

interface RuneListResponse {
  version: string;
  previousVersion?: string;
  runes: RuneListItem[];
  sourceNotice: string;
}

interface RuneDetailResponse {
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
    latestChangeTag: HeroChangeTag;
    latestChangeSummary: string;
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
  cooldownBurn?: string;
  costBurn?: string;
  rangeBurn?: string;
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

interface DataDragonItemGold {
  total?: number;
  sell?: number;
}

interface DataDragonItem {
  name?: string;
  plaintext?: string;
  description?: string;
  image?: DataDragonImage;
  gold?: DataDragonItemGold;
  tags?: string[];
  stats?: Record<string, number>;
}

interface DataDragonItemsPayload {
  data: Record<string, DataDragonItem>;
}

interface DataDragonRune {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

interface DataDragonRuneSlot {
  runes: DataDragonRune[];
}

interface DataDragonRuneTree {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: DataDragonRuneSlot[];
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

function numericTokens(input: string): number[] {
  const matches = input.match(/-?\d+(\.\d+)?/g) ?? [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function sumNumbers(values: number[]): number {
  return values.reduce((acc, cur) => acc + cur, 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasHomeReportContent(input: {
  updates?: HomeVersionUpdate[];
  spotlight?: string[];
  report?: HomeVersionReport;
}): boolean {
  const updatesCount = input.updates?.length ?? 0;
  const spotlightCount = input.spotlight?.length ?? 0;
  const heroCount = input.report?.heroChanges?.length ?? 0;
  const itemCount = input.report?.itemChanges?.length ?? 0;
  const runeCount = input.report?.runeChanges?.length ?? 0;
  return updatesCount > 0 || spotlightCount > 0 || heroCount > 0 || itemCount > 0 || runeCount > 0;
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDelta(current: number, previous: number): string {
  const delta = Number((current - previous).toFixed(2));
  if (delta === 0) return '0';
  return delta > 0 ? `+${delta}` : String(delta);
}

const HERO_STAT_LABELS: Record<string, string> = {
  hp: '生命值',
  hpperlevel: '每级生命成长',
  mp: '法力值',
  mpperlevel: '每级法力成长',
  armor: '护甲',
  armorperlevel: '每级护甲成长',
  attackdamage: '攻击力',
  attackdamageperlevel: '每级攻击力成长',
};

function inferItemChangeTag(
  current: DataDragonItem,
  previous?: DataDragonItem
): { tag: HeroChangeTag; summary: string } {
  if (!previous) return { tag: 'NEUTRAL', summary: '暂无上一版本对比数据' };
  const currentText = `${current.plaintext ?? ''} ${current.description ?? ''}`;
  const previousText = `${previous.plaintext ?? ''} ${previous.description ?? ''}`;
  const numericDiff = sumNumbers(numericTokens(currentText)) - sumNumbers(numericTokens(previousText));
  const currentGold = current.gold?.total ?? 0;
  const previousGold = previous.gold?.total ?? 0;
  const score = numericDiff * 0.2 + (previousGold - currentGold) * 0.5;
  if (score >= 5) return { tag: 'BUFF', summary: '相较上版本效果提升或价格更优（推断）' };
  if (score <= -5) return { tag: 'NERF', summary: '相较上版本效果下调或价格上升（推断）' };
  return { tag: 'NEUTRAL', summary: '相较上版本改动有限（推断）' };
}

function inferRuneChangeTag(
  current: DataDragonRune,
  previous?: DataDragonRune
): { tag: HeroChangeTag; summary: string } {
  if (!previous) return { tag: 'NEUTRAL', summary: '暂无上一版本对比数据' };
  const currentValue = sumNumbers(numericTokens(`${current.shortDesc} ${current.longDesc}`));
  const previousValue = sumNumbers(numericTokens(`${previous.shortDesc} ${previous.longDesc}`));
  const score = currentValue - previousValue;
  if (score >= 2) return { tag: 'BUFF', summary: '描述数值相较上版本提升（推断）' };
  if (score <= -2) return { tag: 'NERF', summary: '描述数值相较上版本下降（推断）' };
  return { tag: 'NEUTRAL', summary: '相较上版本改动有限（推断）' };
}

export class AppShellService {
  private readonly store = createPersistentStateStore('app-shell-v2');
  private readonly runtimeConfig = loadRuntimeConfig();
  private readonly homeRefreshMs = Math.max(5, Number(process.env.APP_HOME_REFRESH_MINUTES ?? 60)) * 60 * 1000;
  private readonly dbModeEnabled: boolean;
  private dbWriteAvailable = true;
  private dbTablesReady = false;
  private homeCache?: {
    version: string;
    previousVersion?: string;
    generatedAt: string;
    updates: HomeVersionUpdate[];
    spotlight: string[];
    buffHighlights: HomeInsightItem[];
    nerfHighlights: HomeInsightItem[];
    report: HomeVersionReport;
    sourceNotice: string;
  };
  private heroCache?: {
    cachedAt: number;
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentChampions: Record<string, DataDragonChampion>;
    previousChampions: Record<string, DataDragonChampion>;
  };
  private itemCache?: {
    cachedAt: number;
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentItems: Record<string, DataDragonItem>;
    previousItems: Record<string, DataDragonItem>;
  };
  private runeCache?: {
    cachedAt: number;
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentRunes: Record<string, DataDragonRune & { tree: string }>;
    previousRunes: Record<string, DataDragonRune & { tree: string }>;
  };

  constructor(private readonly provider: CapabilityProvider, runtimeMode: 'mock' | 'db') {
    this.dbModeEnabled = runtimeMode === 'db';
    void this.refreshHomeDashboard();
    setInterval(() => {
      void this.refreshHomeDashboard();
    }, this.homeRefreshMs);
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

      CREATE TABLE IF NOT EXISTS ${appShellTable('app_version_change_reports')} (
        version TEXT PRIMARY KEY,
        previous_version TEXT,
        report_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ${appShellTable('app_ddragon_payload_cache')} (
        cache_type TEXT NOT NULL,
        version TEXT NOT NULL,
        payload_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (cache_type, version)
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

  async getHomeDashboard(_userId: string, versionOverride?: string): Promise<{
    latestVersion: string;
    previousVersion?: string;
    updates: HomeVersionUpdate[];
    spotlight: string[];
    buffHighlights: HomeInsightItem[];
    nerfHighlights: HomeInsightItem[];
    report: HomeVersionReport;
    sourceNotice: string;
    generatedAt: string;
  }> {
    let home:
      | {
          version: string;
          previousVersion?: string;
          generatedAt: string;
          updates: HomeVersionUpdate[];
          spotlight: string[];
          buffHighlights: HomeInsightItem[];
          nerfHighlights: HomeInsightItem[];
          sourceNotice: string;
        }
      | undefined;
    try {
      home = await this.refreshHomeDashboard(versionOverride);
    } catch (error) {
      console.warn('[app-shell][home] refresh failed, fallback to cache', {
        error: errorMessage(error),
      });
      home = this.homeCache;
    }
    if (!home) {
      const nowIso = new Date().toISOString();
      home = {
        version: 'unknown',
        previousVersion: undefined,
        generatedAt: nowIso,
        spotlight: ['版本数据暂不可用', '请稍后重试', '已启用兜底内容'],
        buffHighlights: [],
        nerfHighlights: [],
        report: { heroChanges: [], itemChanges: [], runeChanges: [] },
        updates: [
          {
            id: 'fallback-1',
            title: '版本数据加载中',
            detail: 'Data Dragon 暂不可用，正在使用兜底内容。',
            patch: 'unknown',
            publishedAt: nowIso,
            source: 'DATA_DRAGON_RULE',
          },
        ],
        sourceNotice: '版本数据来源暂不可用，已启用兜底内容。',
      };
    }
    return {
      latestVersion: home.version,
      previousVersion: home.previousVersion,
      updates: home.updates,
      spotlight: home.spotlight,
      buffHighlights: home.buffHighlights,
      nerfHighlights: home.nerfHighlights,
      report: home.report,
      sourceNotice: home.sourceNotice,
      generatedAt: home.generatedAt,
    };
  }

  async getHomeVersionHistory(limit = 30): Promise<{
    latestVersion: string;
    versions: Array<{ version: string; previousVersion?: string; cached: boolean }>;
  }> {
    const { versions } = await this.loadVersionList();
    const cached = new Set(this.listCachedReportVersionsFromDb(200).map((item) => item.version));
    const list = versions.slice(0, Math.max(5, Math.min(limit, 120))).map((version, index) => ({
      version,
      previousVersion: versions[index + 1],
      cached: cached.has(version),
    }));
    return {
      latestVersion: versions[0] ?? 'unknown',
      versions: list,
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
    charts: {
      winRateTrend: number[];
      kdaTrend: number[];
      killsTrend: number[];
      deathsTrend: number[];
    };
    narrative: string;
    keyInsights: string[];
  }> {
    const regions: Region[] = ['INTERNATIONAL', 'CN'];
    let linkedAccount: Awaited<ReturnType<CapabilityProvider['getLinkedAccount']>>;
    let linkedRegion: Region = 'INTERNATIONAL';

    for (const region of regions) {
      try {
        const account = await this.provider.getLinkedAccount(userId, region);
        if (account) {
          linkedAccount = account;
          linkedRegion = region;
          break;
        }
      } catch {
        continue;
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
        charts: {
          winRateTrend: [],
          kdaTrend: [],
          killsTrend: [],
          deathsTrend: [],
        },
        narrative: '绑定游戏账号后，即可看到你的最近胜率、段位变化和训练趋势。',
        keyInsights: ['当前未绑定游戏账号', '完成绑定后会自动生成近 10 局趋势图', '可结合复盘结果持续跟踪提升'],
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

    let recent: Awaited<ReturnType<CapabilityProvider['listRecentMatches']>>;
    try {
      recent = await this.provider.listRecentMatches(linkedRegion, linkedAccount.accountId, 10);
    } catch (error) {
      const message = errorMessage(error);
      const invalidAccountId = /INVALID_MATCH_ACCOUNT_ID|Exception decrypting|Riot API 400/i.test(message);
      return {
        stats: {
          recentWinRate: 0,
          rankTrend: 'FLAT',
          wins: 0,
          losses: 0,
          kda: '0.00',
        },
        charts: {
          winRateTrend: [],
          kdaTrend: [],
          killsTrend: [],
          deathsTrend: [],
        },
        narrative: invalidAccountId
          ? '当前绑定账号的历史标识已失效，请重新绑定游戏账号后再查看数据中心。'
          : '数据中心暂时不可用，请稍后重试。',
        keyInsights: invalidAccountId
          ? ['检测到账号标识不是有效 puuid', '请在“我的”页重新绑定账号', '重新绑定后会恢复最近对局统计']
          : ['最近对局拉取失败', '可稍后重试', message],
      };
    }
    const summaries = recent.summaries;
    const wins = summaries.filter((item) => item.outcome === 'WIN').length;
    const losses = summaries.length - wins;
    const winRate = summaries.length > 0 ? wins / summaries.length : 0;
    const trend = trendFromWinRate(winRate);
    const kda = formatKda(summaries);

    const ordered = [...summaries].reverse();
    const winRateTrend: number[] = [];
    const kdaTrend: number[] = [];
    const killsTrend: number[] = [];
    const deathsTrend: number[] = [];
    let winCount = 0;
    let sumKills = 0;
    let sumAssists = 0;
    let sumDeaths = 0;

    for (const item of ordered) {
      if (item.outcome === 'WIN') winCount += 1;
      sumKills += item.kills;
      sumAssists += item.assists;
      sumDeaths += item.deaths;
      const idx = winRateTrend.length + 1;
      winRateTrend.push(Number(((winCount / idx) * 100).toFixed(1)));
      kdaTrend.push(Number(((sumKills + sumAssists) / Math.max(1, sumDeaths)).toFixed(2)));
      killsTrend.push(item.kills);
      deathsTrend.push(item.deaths);
    }

    const narrative =
      trend === 'UP'
        ? `经电竞私教指导后，你最近 ${summaries.length} 局胜率明显提升，段位趋势向上。继续保持对中期资源点的提前站位。`
        : trend === 'DOWN'
          ? '最近对局胜率有下滑，建议优先复盘中期转线和资源团决策，先稳住节奏。'
          : '近期状态比较稳定，建议把复盘重点放在高代价死亡和关键资源前的视野布局。';

    const avgKills = summaries.length > 0 ? summaries.reduce((sum, item) => sum + item.kills, 0) / summaries.length : 0;
    const avgDeaths = summaries.length > 0 ? summaries.reduce((sum, item) => sum + item.deaths, 0) / summaries.length : 0;
    const avgAssists = summaries.length > 0 ? summaries.reduce((sum, item) => sum + item.assists, 0) / summaries.length : 0;

    return {
      stats: {
        recentWinRate: Number((winRate * 100).toFixed(1)),
        rankTrend: trend,
        wins,
        losses,
        kda,
      },
      charts: {
        winRateTrend,
        kdaTrend,
        killsTrend,
        deathsTrend,
      },
      narrative,
      keyInsights: [
        `近 ${summaries.length} 局场均 ${avgKills.toFixed(1)} / ${avgDeaths.toFixed(1)} / ${avgAssists.toFixed(1)}`,
        `当前综合 KDA ${kda}，最近胜率 ${Number((winRate * 100).toFixed(1))}%`,
        trend === 'UP' ? '趋势判断：状态上升，建议保持节奏优势' : trend === 'DOWN' ? '趋势判断：状态下滑，建议优先止损' : '趋势判断：状态平稳，可继续细化训练目标',
      ],
    };
  }
  async getHeroesDashboard(input: { position?: HeroPosition; changeTag?: 'ALL' | HeroChangeTag }): Promise<HeroListResponse> {
    const snapshot = await this.loadHeroSnapshot();
    const targetPosition = input.position ?? 'ALL';
    const targetChangeTag = input.changeTag ?? 'ALL';
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
      .filter((item) => targetChangeTag === 'ALL' || item.latestChangeTag === targetChangeTag)
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
      description: stripHtmlTags(passiveRaw?.description ?? '暂无被动技能说明'),
      iconUrl: passiveRaw?.image?.full
        ? `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/passive/${passiveRaw.image.full}`
        : avatarUrl,
    };
    const spellsRaw = Array.isArray(champion.spells) ? champion.spells : [];
    const spells: HeroSpellDetail[] = spellsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      description: stripHtmlTags(item.description),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/spell/${item.image.full}`,
      cooldown: item.cooldownBurn,
      cost: item.costBurn,
      range: item.rangeBurn,
    }));
    const stats: Record<string, number> = {};
    Object.entries(champion.stats).forEach(([key, value]) => {
      const label = HERO_STAT_LABELS[key] ?? key;
      stats[label] = value;
    });

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      champion: {
        championId: champion.id,
        name: champion.name,
        title: champion.title,
        lore: stripHtmlTags(champion.lore ?? champion.blurb ?? '暂无英雄背景故事'),
        avatarUrl,
        positions: mapTagsToPositions(champion.tags),
        latestChangeTag: change.tag,
        latestChangeSummary: change.summary,
        stats,
        passive,
        spells,
      },
      sourceNotice: snapshot.sourceNotice,
    };
  }

  async getItemsDashboard(input: { changeTag?: 'ALL' | HeroChangeTag }): Promise<ItemListResponse> {
    const snapshot = await this.loadItemSnapshot();
    const targetChangeTag = input.changeTag ?? 'ALL';
    const items = Object.entries(snapshot.currentItems)
      .map(([itemId, current]) => {
        const previous = snapshot.previousItems[itemId];
        const change = inferItemChangeTag(current, previous);
        return {
          itemId,
          name: current.name ?? `装备 ${itemId}`,
          plainText: stripHtmlTags(current.plaintext ?? '暂无描述'),
          iconUrl: `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/item/${itemId}.png`,
          latestChangeTag: change.tag,
          latestChangeSummary: change.summary,
        } as ItemListItem;
      })
      .filter((item) => targetChangeTag === 'ALL' || item.latestChangeTag === targetChangeTag)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      items,
      sourceNotice: snapshot.sourceNotice,
    };
  }

  async getItemDetail(input: { itemId: string }): Promise<ItemDetailResponse | undefined> {
    const snapshot = await this.loadItemSnapshot();
    const current = snapshot.currentItems[input.itemId];
    if (!current) return undefined;
    const previous = snapshot.previousItems[input.itemId];
    const change = inferItemChangeTag(current, previous);
    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      item: {
        itemId: input.itemId,
        name: current.name ?? `装备 ${input.itemId}`,
        plainText: stripHtmlTags(current.plaintext ?? '暂无描述'),
        description: stripHtmlTags(current.description ?? '暂无描述'),
        iconUrl: `https://ddragon.leagueoflegends.com/cdn/${snapshot.version}/img/item/${input.itemId}.png`,
        goldTotal: current.gold?.total ?? 0,
        goldSell: current.gold?.sell ?? 0,
        tags: current.tags ?? [],
        stats: current.stats ?? {},
        latestChangeTag: change.tag,
        latestChangeSummary: change.summary,
      },
      sourceNotice: snapshot.sourceNotice,
    };
  }

  async getRunesDashboard(input: { changeTag?: 'ALL' | HeroChangeTag }): Promise<RuneListResponse> {
    const snapshot = await this.loadRuneSnapshot();
    const targetChangeTag = input.changeTag ?? 'ALL';
    const runes = Object.values(snapshot.currentRunes)
      .map((current) => {
        const previous = snapshot.previousRunes[String(current.id)];
        const change = inferRuneChangeTag(current, previous);
        return {
          runeId: String(current.id),
          key: current.key,
          name: current.name,
          tree: current.tree,
          iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/${current.icon}`,
          latestChangeTag: change.tag,
          latestChangeSummary: change.summary,
        } as RuneListItem;
      })
      .filter((item) => targetChangeTag === 'ALL' || item.latestChangeTag === targetChangeTag)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      runes,
      sourceNotice: snapshot.sourceNotice,
    };
  }

  async getRuneDetail(input: { runeId: string }): Promise<RuneDetailResponse | undefined> {
    const snapshot = await this.loadRuneSnapshot();
    const current = snapshot.currentRunes[input.runeId];
    if (!current) return undefined;
    const previous = snapshot.previousRunes[input.runeId];
    const change = inferRuneChangeTag(current, previous);

    return {
      version: snapshot.version,
      previousVersion: snapshot.previousVersion,
      rune: {
        runeId: String(current.id),
        key: current.key,
        name: current.name,
        tree: current.tree,
        iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/${current.icon}`,
        shortDesc: stripHtmlTags(current.shortDesc),
        longDesc: stripHtmlTags(current.longDesc),
        latestChangeTag: change.tag,
        latestChangeSummary: change.summary,
      },
      sourceNotice: snapshot.sourceNotice,
    };
  }

  private async refreshHomeDashboard(versionOverride?: string): Promise<{
    version: string;
    previousVersion?: string;
    generatedAt: string;
    updates: HomeVersionUpdate[];
    spotlight: string[];
    buffHighlights: HomeInsightItem[];
    nerfHighlights: HomeInsightItem[];
    report: HomeVersionReport;
    sourceNotice: string;
  }> {
    const { versions } = await this.loadVersionList();
    const version = versionOverride && versions.includes(versionOverride) ? versionOverride : versions[0];
    const previousVersion = version ? versions[versions.indexOf(version) + 1] : undefined;
    if (!version) throw new Error('VERSIONS_EMPTY');

    if (
      !versionOverride &&
      this.homeCache &&
      this.homeCache.version === version &&
      this.homeCache.previousVersion === previousVersion &&
      hasHomeReportContent(this.homeCache)
    ) {
      return this.homeCache;
    }

    const cachedReport = this.readVersionReportFromDb(version);
    if (
      cachedReport &&
      cachedReport.previousVersion === previousVersion &&
      hasHomeReportContent(cachedReport)
    ) {
      if (!versionOverride) this.homeCache = cachedReport;
      return cachedReport;
    }

    const currentPayload = await this.fetchChampionPayloadCached(version);
    const previousPayload = previousVersion ? await this.fetchChampionPayloadCached(previousVersion) : undefined;
    const currentItems = await this.fetchItemPayloadCached(version);
    const previousItems = previousVersion ? await this.fetchItemPayloadCached(previousVersion) : { data: {} };
    const currentRunes = await this.fetchRunePayloadCached(version);
    const previousRunes = previousVersion ? await this.fetchRunePayloadCached(previousVersion) : [];
    const compared = Object.values(currentPayload.data).map((champion) => {
      const previous = previousPayload?.data?.[champion.id];
      const change = inferChampionChangeTag(champion, previous);
      return {
        championId: champion.id,
        champion: champion.name,
        tag: change.tag,
        summary: change.summary,
        avatarUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
      };
    });
    const spotlight = [
      `增强：${compared.filter((item) => item.tag === 'BUFF').slice(0, 6).map((item) => item.champion).join('、') || '暂无明显增强'}`,
      `削弱：${compared.filter((item) => item.tag === 'NERF').slice(0, 6).map((item) => item.champion).join('、') || '暂无明显削弱'}`,
      `中性：${compared.filter((item) => item.tag === 'NEUTRAL').length} 位`,
    ];

    const buffHighlights: HomeInsightItem[] = compared
      .filter((item) => item.tag === 'BUFF')
      .slice(0, 8)
      .map((item) => ({
        championId: item.championId,
        championName: item.champion,
        avatarUrl: item.avatarUrl,
        summary: item.summary,
      }));
    const nerfHighlights: HomeInsightItem[] = compared
      .filter((item) => item.tag === 'NERF')
      .slice(0, 8)
      .map((item) => ({
        championId: item.championId,
        championName: item.champion,
        avatarUrl: item.avatarUrl,
        summary: item.summary,
      }));
    const report = this.buildHomeVersionReport({
      version,
      previousVersion,
      currentChampions: currentPayload,
      previousChampions: previousPayload,
      currentItems,
      previousItems,
      currentRunes,
      previousRunes,
    });

    const updates = await this.generateHomeUpdatesWithLlm({
      version,
      previousVersion,
      spotlight,
      compared,
    });
    const home = {
      version,
      previousVersion,
      generatedAt: new Date().toISOString(),
      updates,
      spotlight,
      buffHighlights,
      nerfHighlights,
      report,
      sourceNotice:
        updates[0]?.source === 'DATA_DRAGON_LLM'
          ? '版本变动由 Data Dragon 差异 + LLM 结构化生成。'
          : '版本变动由 Data Dragon 差异规则生成（LLM 不可用时自动降级）。',
    };
    this.writeVersionReportToDb({
      version,
      previousVersion,
      updates,
      spotlight,
      buffHighlights,
      nerfHighlights,
      report,
      sourceNotice: home.sourceNotice,
    });
    if (!versionOverride) this.homeCache = home;
    return home;
  }

  private async generateHomeUpdatesWithLlm(input: {
    version: string;
    previousVersion?: string;
    spotlight: string[];
    compared: Array<{ championId: string; champion: string; tag: HeroChangeTag; summary: string; avatarUrl: string }>;
  }): Promise<HomeVersionUpdate[]> {
    const nowIso = new Date().toISOString();
    const fallback = this.generateRuleHomeUpdates(input, nowIso);
    if (!this.runtimeConfig.llmEnabled || !this.runtimeConfig.llmApiKey) return fallback;

    try {
      const response = await fetch(this.runtimeConfig.llmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.runtimeConfig.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.runtimeConfig.llmModel,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '你是LOL版本分析助手。输出JSON：{"updates":[{"id":"","title":"","detail":"","patch":"","publishedAt":"ISO"}]}，请给出5到8条中文结构化版本摘要。',
            },
            { role: 'user', content: JSON.stringify(input) },
          ],
        }),
      });
      if (!response.ok) return fallback;
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return fallback;
      const parsed = JSON.parse(content) as {
        updates?: Array<{ id?: string; title?: string; detail?: string; patch?: string; publishedAt?: string }>;
      };
      const updates = (parsed.updates ?? [])
        .filter((item) => item.title && item.detail)
        .slice(0, 8)
        .map((item, index) => ({
          id: item.id ?? `llm-${index + 1}`,
          title: item.title ?? `版本观察 ${index + 1}`,
          detail: item.detail ?? '',
          patch: item.patch ?? input.version,
          publishedAt: item.publishedAt ?? nowIso,
          source: 'DATA_DRAGON_LLM' as const,
        }));
      return updates.length > 0 ? updates : fallback;
    } catch {
      return fallback;
    }
  }

  private readPayloadCacheFromDb<T>(cacheType: 'champions' | 'items' | 'runes', version: string): T | undefined {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return undefined;
    try {
      this.ensureAppShellTables();
      const rowsRaw = execPsql(`
        SELECT payload_json::text AS payload
        FROM ${appShellTable('app_ddragon_payload_cache')}
        WHERE cache_type = ${safeSqlString(cacheType)}
          AND version = ${safeSqlString(version)}
        LIMIT 1;
      `);
      const rows = parseJsonRows<{ payload: string }>(rowsRaw);
      const payloadText = rows[0]?.payload;
      if (!payloadText) return undefined;
      return JSON.parse(payloadText) as T;
    } catch {
      return undefined;
    }
  }

  private writePayloadCacheToDb(cacheType: 'champions' | 'items' | 'runes', version: string, payload: unknown): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      const payloadText = JSON.stringify(payload ?? {}).replace(/'/g, "''");
      execPsql(`
        INSERT INTO ${appShellTable('app_ddragon_payload_cache')} (
          cache_type, version, payload_json, created_at, updated_at
        ) VALUES (
          ${safeSqlString(cacheType)},
          ${safeSqlString(version)},
          '${payloadText}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (cache_type, version)
        DO UPDATE SET
          payload_json = EXCLUDED.payload_json,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  private readVersionReportFromDb(version: string): {
    version: string;
    previousVersion?: string;
    generatedAt: string;
    updates: HomeVersionUpdate[];
    spotlight: string[];
    buffHighlights: HomeInsightItem[];
    nerfHighlights: HomeInsightItem[];
    report: HomeVersionReport;
    sourceNotice: string;
  } | undefined {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return undefined;
    try {
      this.ensureAppShellTables();
      const rowsRaw = execPsql(`
        SELECT
          version,
          previous_version,
          report_json::text AS report_json,
          updated_at::text AS updated_at
        FROM ${appShellTable('app_version_change_reports')}
        WHERE version = ${safeSqlString(version)}
        LIMIT 1;
      `);
      const rows = parseJsonRows<{ version: string; previous_version: string | null; report_json: string; updated_at: string }>(rowsRaw);
      const row = rows[0];
      if (!row?.report_json) return undefined;
      const parsed = JSON.parse(row.report_json) as {
        updates?: HomeVersionUpdate[];
        spotlight?: string[];
        buffHighlights?: HomeInsightItem[];
        nerfHighlights?: HomeInsightItem[];
        report?: HomeVersionReport;
        sourceNotice?: string;
      };
      return {
        version: row.version,
        previousVersion: row.previous_version ?? undefined,
        generatedAt: row.updated_at,
        updates: parsed.updates ?? [],
        spotlight: parsed.spotlight ?? [],
        buffHighlights: parsed.buffHighlights ?? [],
        nerfHighlights: parsed.nerfHighlights ?? [],
        report: parsed.report ?? { heroChanges: [], itemChanges: [], runeChanges: [] },
        sourceNotice: parsed.sourceNotice ?? '版本变动来自缓存数据库。',
      };
    } catch {
      return undefined;
    }
  }

  private writeVersionReportToDb(input: {
    version: string;
    previousVersion?: string;
    updates: HomeVersionUpdate[];
    spotlight: string[];
    buffHighlights: HomeInsightItem[];
    nerfHighlights: HomeInsightItem[];
    report: HomeVersionReport;
    sourceNotice: string;
  }): void {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return;
    try {
      this.ensureAppShellTables();
      const payloadText = JSON.stringify({
        updates: input.updates,
        spotlight: input.spotlight,
        buffHighlights: input.buffHighlights,
        nerfHighlights: input.nerfHighlights,
        report: input.report,
        sourceNotice: input.sourceNotice,
      }).replace(/'/g, "''");

      execPsql(`
        INSERT INTO ${appShellTable('app_version_change_reports')} (
          version, previous_version, report_json, created_at, updated_at
        ) VALUES (
          ${safeSqlString(input.version)},
          ${input.previousVersion ? safeSqlString(input.previousVersion) : 'NULL'},
          '${payloadText}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (version)
        DO UPDATE SET
          previous_version = EXCLUDED.previous_version,
          report_json = EXCLUDED.report_json,
          updated_at = NOW();
      `);
    } catch {
      this.dbWriteAvailable = false;
    }
  }

  private listCachedReportVersionsFromDb(limit = 40): Array<{ version: string; previousVersion?: string; updatedAt: string }> {
    if (!this.dbModeEnabled || !this.dbWriteAvailable) return [];
    try {
      this.ensureAppShellTables();
      const rowsRaw = execPsql(`
        SELECT version, previous_version, updated_at::text AS updated_at
        FROM ${appShellTable('app_version_change_reports')}
        ORDER BY updated_at DESC
        LIMIT ${Math.max(1, Math.min(limit, 200))};
      `);
      const rows = parseJsonRows<{ version: string; previous_version: string | null; updated_at: string }>(rowsRaw);
      return rows.map((row) => ({
        version: row.version,
        previousVersion: row.previous_version ?? undefined,
        updatedAt: row.updated_at,
      }));
    } catch {
      return [];
    }
  }

  private generateRuleHomeUpdates(
    input: {
      version: string;
      previousVersion?: string;
      spotlight: string[];
      compared: Array<{ championId: string; champion: string; tag: HeroChangeTag; summary: string; avatarUrl: string }>;
    },
    nowIso: string
  ): HomeVersionUpdate[] {
    const buffs = input.compared.filter((item) => item.tag === 'BUFF').slice(0, 5);
    const nerfs = input.compared.filter((item) => item.tag === 'NERF').slice(0, 5);
    const neutrals = input.compared.filter((item) => item.tag === 'NEUTRAL').length;
    return [
      {
        id: 'rule-overview',
        title: `${input.version} 版本平衡概览`,
        detail: `与 ${input.previousVersion ?? '上一版本'} 对比，本次推断增强 ${buffs.length} 位、削弱 ${nerfs.length} 位、中性 ${neutrals} 位。`,
        patch: input.version,
        publishedAt: nowIso,
        source: 'DATA_DRAGON_RULE',
      },
      {
        id: 'rule-buff',
        title: '重点增强英雄',
        detail: buffs.length ? buffs.map((item) => `${item.champion}（${item.summary}）`).join('；') : '暂无明显增强英雄。',
        patch: input.version,
        publishedAt: nowIso,
        source: 'DATA_DRAGON_RULE',
      },
      {
        id: 'rule-nerf',
        title: '重点削弱英雄',
        detail: nerfs.length ? nerfs.map((item) => `${item.champion}（${item.summary}）`).join('；') : '暂无明显削弱英雄。',
        patch: input.version,
        publishedAt: nowIso,
        source: 'DATA_DRAGON_RULE',
      },
      {
        id: 'rule-advice',
        title: '版本环境建议',
        detail: '当前环境更强调中期资源前站位与视野衔接，建议优先优化资源团前 20 秒落位。',
        patch: input.version,
        publishedAt: nowIso,
        source: 'DATA_DRAGON_RULE',
      },
      {
        id: 'rule-soloq',
        title: '单排上分建议',
        detail: '优先选择稳定中期控图英雄，减少无信息接团，把“先信息后动作”当作硬规则。',
        patch: input.version,
        publishedAt: nowIso,
        source: 'DATA_DRAGON_RULE',
      },
    ];
  }

  private buildHomeVersionReport(input: {
    version: string;
    previousVersion?: string;
    currentChampions: DataDragonChampionsPayload;
    previousChampions?: DataDragonChampionsPayload;
    currentItems: DataDragonItemsPayload;
    previousItems?: DataDragonItemsPayload;
    currentRunes: DataDragonRuneTree[];
    previousRunes: DataDragonRuneTree[];
  }): HomeVersionReport {
    const heroChanges: HomeHeroChangeItem[] = Object.values(input.currentChampions.data)
      .map((champion) => {
        const prev = input.previousChampions?.data?.[champion.id];
        if (!prev) return undefined;
        const statParts: string[] = [];
        (['attackdamage', 'attackdamageperlevel', 'hp', 'hpperlevel', 'armor', 'armorperlevel', 'mp', 'mpperlevel'] as const).forEach((key) => {
          const curVal = champion.stats[key];
          const prevVal = prev.stats[key];
          if (curVal !== prevVal) {
            statParts.push(`${HERO_STAT_LABELS[key]} ${formatDelta(curVal, prevVal)}`);
          }
        });
        const currentSpells = Array.isArray(champion.spells) ? champion.spells : [];
        const prevSpells = Array.isArray(prev.spells) ? prev.spells : [];
        const changedSkills = currentSpells
          .filter((spell, index) => spell.description !== prevSpells[index]?.description)
          .map((spell) => spell.name);
        if (statParts.length === 0 && changedSkills.length === 0) return undefined;
        return {
          championId: champion.id,
          championName: champion.name,
          avatarUrl: `https://ddragon.leagueoflegends.com/cdn/${input.version}/img/champion/${champion.image.full}`,
          statDelta: statParts.join('；') || '基础数值无明显变动',
          skillDelta: changedSkills.length ? `技能调整：${changedSkills.join('、')}` : undefined,
        } as HomeHeroChangeItem;
      })
      .filter((item): item is HomeHeroChangeItem => Boolean(item))
      .slice(0, 20);

    const itemChanges: HomeItemChangeItem[] = Object.entries(input.currentItems.data)
      .map(([itemId, item]) => {
        const prev = input.previousItems?.data?.[itemId];
        if (!prev) return undefined;
        const change = inferItemChangeTag(item, prev);
        const hasTextDiff = (item.plaintext ?? '') !== (prev.plaintext ?? '') || (item.description ?? '') !== (prev.description ?? '');
        const hasGoldDiff = (item.gold?.total ?? 0) !== (prev.gold?.total ?? 0) || (item.gold?.sell ?? 0) !== (prev.gold?.sell ?? 0);
        if (!hasTextDiff && !hasGoldDiff) return undefined;
        return {
          itemId,
          itemName: item.name ?? `装备 ${itemId}`,
          iconUrl: `https://ddragon.leagueoflegends.com/cdn/${input.version}/img/item/${itemId}.png`,
          changeSummary: change.summary,
        } as HomeItemChangeItem;
      })
      .filter((item): item is HomeItemChangeItem => Boolean(item))
      .slice(0, 20);

    const toRuneMap = (trees: DataDragonRuneTree[]) => {
      const map: Record<string, DataDragonRune> = {};
      for (const tree of trees) {
        for (const slot of tree.slots) {
          for (const rune of slot.runes) {
            map[String(rune.id)] = rune;
          }
        }
      }
      return map;
    };
    const currentRuneMap = toRuneMap(input.currentRunes);
    const prevRuneMap = toRuneMap(input.previousRunes);
    const runeChanges: HomeRuneChangeItem[] = Object.values(currentRuneMap)
      .map((rune) => {
        const prev = prevRuneMap[String(rune.id)];
        if (!prev) return undefined;
        const change = inferRuneChangeTag(rune, prev);
        if (rune.shortDesc === prev.shortDesc && rune.longDesc === prev.longDesc) return undefined;
        return {
          runeId: String(rune.id),
          runeName: rune.name,
          iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`,
          changeSummary: change.summary,
        } as HomeRuneChangeItem;
      })
      .filter((item): item is HomeRuneChangeItem => Boolean(item))
      .slice(0, 20);

    return { heroChanges, itemChanges, runeChanges };
  }

  private async loadVersionList(): Promise<{ versions: string[] }> {
    const url = 'https://ddragon.leagueoflegends.com/api/versions.json';
    try {
      const versionResponse = await fetch(url);
      if (!versionResponse.ok) {
        console.warn('[app-shell][home] versions fetch non-200', {
          url,
          status: versionResponse.status,
          statusText: versionResponse.statusText,
        });
        throw new Error(`VERSIONS_FETCH_FAILED_${versionResponse.status}`);
      }
      const versions = (await versionResponse.json()) as string[];
      const version = versions[0];
      if (!version) {
        console.warn('[app-shell][home] versions payload empty', { url, size: versions.length });
        throw new Error('VERSIONS_EMPTY');
      }
      console.log('[app-shell][home] versions resolved', {
        latestVersion: version,
        previousVersion: versions[1] ?? null,
        total: versions.length,
      });
      return { versions };
    } catch (error) {
      console.error('[app-shell][home] versions fetch failed', {
        url,
        error: errorMessage(error),
      });
      throw error;
    }
  }

  private async loadLatestVersions(): Promise<{ version: string; previousVersion?: string }> {
    const { versions } = await this.loadVersionList();
    const version = versions[0];
    if (!version) throw new Error('VERSIONS_EMPTY');
    return { version, previousVersion: versions[1] };
  }

  private async fetchChampionPayloadCached(version: string): Promise<DataDragonChampionsPayload> {
    const cached = this.readPayloadCacheFromDb<DataDragonChampionsPayload>('champions', version);
    if (cached?.data) return cached;
    const payload = await this.fetchChampionPayload(version);
    this.writePayloadCacheToDb('champions', version, payload);
    return payload;
  }

  private async fetchItemPayloadCached(version: string): Promise<DataDragonItemsPayload> {
    const cached = this.readPayloadCacheFromDb<DataDragonItemsPayload>('items', version);
    if (cached?.data) return cached;
    const payload = await this.fetchItemPayload(version);
    this.writePayloadCacheToDb('items', version, payload);
    return payload;
  }

  private async fetchRunePayloadCached(version: string): Promise<DataDragonRuneTree[]> {
    const cached = this.readPayloadCacheFromDb<DataDragonRuneTree[]>('runes', version);
    if (Array.isArray(cached) && cached.length > 0) return cached;
    const payload = await this.fetchRunePayload(version);
    this.writePayloadCacheToDb('runes', version, payload);
    return payload;
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

    const { version, previousVersion } = await this.loadLatestVersions();
    const currentPayload = await this.fetchChampionPayloadCached(version);
    const previousPayload = previousVersion ? await this.fetchChampionPayloadCached(previousVersion) : undefined;

    const snapshot = {
      cachedAt: now,
      version,
      previousVersion,
      sourceNotice: '英雄数据来源于 Data Dragon。增强/削弱标签为当前版本与上一版本基础属性对比推断。',
      currentChampions: currentPayload.data,
      previousChampions: previousPayload?.data ?? {},
    };
    this.heroCache = snapshot;
    return snapshot;
  }

  private async loadItemSnapshot(): Promise<{
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentItems: Record<string, DataDragonItem>;
    previousItems: Record<string, DataDragonItem>;
  }> {
    const now = Date.now();
    if (this.itemCache && now - this.itemCache.cachedAt < 10 * 60 * 1000) {
      return this.itemCache;
    }

    const { version, previousVersion } = await this.loadLatestVersions();
    const currentPayload = await this.fetchItemPayloadCached(version);
    const previousPayload = previousVersion ? await this.fetchItemPayloadCached(previousVersion) : undefined;
    const snapshot = {
      cachedAt: now,
      version,
      previousVersion,
      sourceNotice: '装备数据来源于 Data Dragon。增强/削弱标签基于文本与金币变化推断。',
      currentItems: currentPayload.data,
      previousItems: previousPayload?.data ?? {},
    };
    this.itemCache = snapshot;
    return snapshot;
  }

  private async loadRuneSnapshot(): Promise<{
    version: string;
    previousVersion?: string;
    sourceNotice: string;
    currentRunes: Record<string, DataDragonRune & { tree: string }>;
    previousRunes: Record<string, DataDragonRune & { tree: string }>;
  }> {
    const now = Date.now();
    if (this.runeCache && now - this.runeCache.cachedAt < 10 * 60 * 1000) {
      return this.runeCache;
    }

    const { version, previousVersion } = await this.loadLatestVersions();
    const currentPayload = await this.fetchRunePayloadCached(version);
    const previousPayload = previousVersion ? await this.fetchRunePayloadCached(previousVersion) : [];
    const toRuneMap = (trees: DataDragonRuneTree[]) => {
      const map: Record<string, DataDragonRune & { tree: string }> = {};
      for (const tree of trees) {
        for (const slot of tree.slots) {
          for (const rune of slot.runes) {
            map[String(rune.id)] = { ...rune, tree: tree.name };
          }
        }
      }
      return map;
    };
    const snapshot = {
      cachedAt: now,
      version,
      previousVersion,
      sourceNotice: '天赋数据来源于 Data Dragon。增强/削弱标签基于描述数值变化推断。',
      currentRunes: toRuneMap(currentPayload),
      previousRunes: toRuneMap(previousPayload),
    };
    this.runeCache = snapshot;
    return snapshot;
  }

  private async fetchChampionPayload(version: string): Promise<DataDragonChampionsPayload> {
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/champion.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('[app-shell][home] champion fetch non-200', {
          version,
          url,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`CHAMPION_FETCH_FAILED_${response.status}`);
      }
      const payload = (await response.json()) as DataDragonChampionsPayload;
      const count = Object.keys(payload.data ?? {}).length;
      console.log('[app-shell][home] champion payload loaded', { version, count });
      return payload;
    } catch (error) {
      console.error('[app-shell][home] champion fetch failed', {
        version,
        url,
        error: errorMessage(error),
      });
      throw error;
    }
  }

  private async fetchItemPayload(version: string): Promise<DataDragonItemsPayload> {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/item.json`);
    if (!response.ok) throw new Error(`ITEM_FETCH_FAILED_${response.status}`);
    return (await response.json()) as DataDragonItemsPayload;
  }

  private async fetchRunePayload(version: string): Promise<DataDragonRuneTree[]> {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/runesReforged.json`);
    if (!response.ok) throw new Error(`RUNE_FETCH_FAILED_${response.status}`);
    return (await response.json()) as DataDragonRuneTree[];
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



