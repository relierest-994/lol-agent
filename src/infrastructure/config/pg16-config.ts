export interface Pg16Config {
  dialect: 'postgres';
  version: 16;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  sslMode: 'disable' | 'require';
  poolMin: number;
  poolMax: number;
  url?: string;
}

export interface Pg16ConfigValidation {
  valid: boolean;
  errors: string[];
}

function readNodeEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function asNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function loadPg16Config(): Pg16Config {
  const env = readNodeEnv();
  const sslRaw = (env.APP_DB_SSL_MODE ?? 'disable').toLowerCase();

  return {
    dialect: 'postgres',
    version: 16,
    host: env.APP_DB_HOST ?? '127.0.0.1',
    port: asNumber(env.APP_DB_PORT, 5432),
    database: env.APP_DB_NAME ?? 'lol_agent',
    user: env.APP_DB_USER ?? 'lol_agent',
    password: env.APP_DB_PASSWORD,
    sslMode: sslRaw === 'require' ? 'require' : 'disable',
    poolMin: asNumber(env.APP_DB_POOL_MIN, 2),
    poolMax: asNumber(env.APP_DB_POOL_MAX, 20),
    url: env.APP_DB_URL,
  };
}

export function validatePg16Config(config: Pg16Config): Pg16ConfigValidation {
  const errors: string[] = [];
  if (config.dialect !== 'postgres') errors.push('APP_DB_DIALECT must be postgres');
  if (config.version !== 16) errors.push('APP_DB_VERSION must be 16');
  if (!config.host.trim()) errors.push('APP_DB_HOST is required');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errors.push('APP_DB_PORT is invalid');
  if (!config.database.trim()) errors.push('APP_DB_NAME is required');
  if (!config.user.trim()) errors.push('APP_DB_USER is required');
  if (config.poolMin < 0) errors.push('APP_DB_POOL_MIN must be >= 0');
  if (config.poolMax < 1) errors.push('APP_DB_POOL_MAX must be >= 1');
  if (config.poolMin > config.poolMax) errors.push('APP_DB_POOL_MIN must be <= APP_DB_POOL_MAX');
  return { valid: errors.length === 0, errors };
}

