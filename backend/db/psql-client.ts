import { execFileSync } from 'node:child_process';

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function getDbSchema(): string {
  return process.env.APP_DB_SCHEMA?.trim() || 'public';
}

function qualifiedTable(tableName: string): string {
  return `${quoteIdentifier(getDbSchema())}.${quoteIdentifier(tableName)}`;
}

const PG_RUNNER_SCRIPT = `
const { Client } = require('pg');
const sql = process.argv[1];
const sslMode = process.env.APP_DB_SSL_MODE || 'disable';
const useSsl = sslMode !== 'disable';
const config = process.env.APP_DB_URL
  ? { connectionString: process.env.APP_DB_URL, ssl: useSsl ? { rejectUnauthorized: false } : undefined }
  : {
      host: process.env.APP_DB_HOST || '127.0.0.1',
      port: Number(process.env.APP_DB_PORT || '5432'),
      user: process.env.APP_DB_USER || 'lol_agent',
      password: process.env.APP_DB_PASSWORD || undefined,
      database: process.env.APP_DB_NAME || 'lol_agent',
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    };

(async () => {
  const client = new Client(config);
  await client.connect();
  const result = await client.query(sql);
  if (result.rows.length === 1 && Object.keys(result.rows[0]).length === 1) {
    const value = Object.values(result.rows[0])[0];
    process.stdout.write(value == null ? '' : String(value));
  } else {
    process.stdout.write(JSON.stringify(result.rows));
  }
  await client.end();
})().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
`.trim();

export function execPsql(sql: string): string {
  try {
    return execFileSync(process.execPath, ['-e', PG_RUNNER_SCRIPT, sql], {
      encoding: 'utf8',
      env: process.env,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`DB query failed: ${error.message}`);
    }
    throw new Error('DB query failed');
  }
}

export function execPsqlScalar(sql: string): string {
  return execPsql(sql).trim();
}

let persistentKvReady = false;
let persistentKvInitError: Error | null = null;

function ensurePersistentStateKvTable(): void {
  if (persistentKvInitError) throw persistentKvInitError;
  if (persistentKvReady) return;

  try {
    execPsql(`
      CREATE TABLE IF NOT EXISTS ${qualifiedTable('persistent_state_kv')} (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (namespace, key)
      );
    `);
    persistentKvReady = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /permission denied/i.test(message) ||
      /insufficient privilege/i.test(message) ||
      /对模式\s*public\s*权限不够/i.test(message)
    ) {
      persistentKvInitError = new Error(
        `DB user lacks CREATE privilege on schema ${getDbSchema()}. Run migrations with privileged account, or grant CREATE/USAGE on target schema to APP_DB_USER.`
      );
      throw persistentKvInitError;
    }
    persistentKvInitError = error instanceof Error ? error : new Error('Failed to initialize persistent_state_kv');
    throw persistentKvInitError;
  }
}

export function insertAgentTaskRun(input: {
  task_run_id: string;
  user_id: string;
  session_id: string;
  intent: string;
  status: string;
  payload: unknown;
  error_code?: string;
}): void {
  const payload = JSON.stringify(input.payload ?? {});
  const errorCode = input.error_code ?? null;
  const values = [
    input.task_run_id,
    input.user_id,
    input.session_id,
    input.intent,
    input.status,
    payload,
    errorCode,
  ].map((item) => (item === null ? 'NULL' : `'${String(item).replace(/'/g, "''")}'`));
  execPsql(
    `INSERT INTO ${qualifiedTable('agent_task_runs')} (
      task_run_id, user_id, session_id, trace_id, correlation_id, intent, status, payload, error_code, created_at, updated_at
    ) VALUES (
      ${values[0]}, ${values[1]}, ${values[2]}, NULL, NULL, ${values[3]}, ${values[4]}, ${values[5]}::jsonb, ${values[6]}, NOW(), NOW()
    );`
  );
}

export function getKv(namespace: string, key: string): string | undefined {
  ensurePersistentStateKvTable();
  const ns = namespace.replace(/'/g, "''");
  const k = key.replace(/'/g, "''");
  const out = execPsqlScalar(
    `SELECT value_json::text FROM ${qualifiedTable('persistent_state_kv')} WHERE namespace='${ns}' AND key='${k}' LIMIT 1;`
  );
  return out || undefined;
}

export function setKv(namespace: string, key: string, valueJsonText: string): void {
  ensurePersistentStateKvTable();
  const ns = namespace.replace(/'/g, "''");
  const k = key.replace(/'/g, "''");
  const v = valueJsonText.replace(/'/g, "''");
  execPsql(`
    INSERT INTO ${qualifiedTable('persistent_state_kv')}(namespace,key,value_json,created_at,updated_at)
    VALUES ('${ns}','${k}','${v}'::jsonb,NOW(),NOW())
    ON CONFLICT(namespace,key)
    DO UPDATE SET value_json=EXCLUDED.value_json,updated_at=NOW();
  `);
}

export function removeKv(namespace: string, key: string): void {
  ensurePersistentStateKvTable();
  const ns = namespace.replace(/'/g, "''");
  const k = key.replace(/'/g, "''");
  execPsql(`DELETE FROM ${qualifiedTable('persistent_state_kv')} WHERE namespace='${ns}' AND key='${k}';`);
}
