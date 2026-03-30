import { execPsqlScalar } from './psql-client';

export interface DbHealthStatus {
  ok: boolean;
  mode: 'mock' | 'db';
  message: string;
  checked_at: string;
}

function runPsqlScalar(sql: string): string {
  return execPsqlScalar(sql);
}

export function getDbHealth(mode: 'mock' | 'db'): DbHealthStatus {
  if (mode === 'mock') {
    return {
      ok: true,
      mode,
      message: 'mock mode (DB not required)',
      checked_at: new Date().toISOString(),
    };
  }

  try {
    runPsqlScalar('SELECT 1;');
    return {
      ok: true,
      mode,
      message: 'db reachable',
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      mode,
      message: error instanceof Error ? error.message : 'db unreachable',
      checked_at: new Date().toISOString(),
    };
  }
}
