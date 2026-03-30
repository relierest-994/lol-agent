import { writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

export const handleHealthRoutes: RouteHandler = async (context, services) => {
  if (context.method === 'GET' && context.path === 'health') {
    writeJson(context.res, 200, { ok: true, service: 'lol-agent-backend', now: new Date().toISOString() });
    return true;
  }

  if (context.method === 'GET' && context.path === 'infra/db/health') {
    const health = services.dbHealth();
    writeJson(context.res, health.ok ? 200 : 503, {
      ok: health.ok,
      mode: health.mode,
      message: health.message,
      checked_at: health.checked_at,
    });
    return true;
  }

  return false;
};
