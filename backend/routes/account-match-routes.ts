import { asString, readRequestBody, writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

export const handleAccountMatchRoutes: RouteHandler = async (context, services) => {
  const { provider } = services;

  if (context.method === 'GET' && context.path === 'accounts/linked') {
    const account = await provider.getLinkedAccount(
      asString(context.url.searchParams.get('user_id')),
      asString(context.url.searchParams.get('region'), 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN'
    );
    writeJson(context.res, 200, account ?? null);
    return true;
  }

  if (context.method === 'POST' && (context.path === 'accounts/link' || context.path === 'accounts/link/mock')) {
    const body = await readRequestBody(context);
    const region = asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
    const account = await provider.linkMockAccount(
      asString(body.user_id),
      region,
      {
        gameName: typeof body.game_name === 'string' ? body.game_name : undefined,
        tagLine: typeof body.tag_line === 'string' ? body.tag_line : undefined,
      }
    );
    if (region === 'INTERNATIONAL' && account.accountId.startsWith('riot-mock-')) {
      throw new Error('REAL_ACCOUNT_LINK_DISABLED: Riot real provider is not enabled. Set RIOT_PROVIDER_ENABLED=true.');
    }
    writeJson(context.res, 200, account);
    return true;
  }

  if (context.method === 'POST' && context.path === 'matches/recent') {
    const body = await readRequestBody(context);
    const data = await provider.listRecentMatches(
      asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
      asString(body.account_id),
      Number(body.limit ?? 5)
    );
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('matches/') && context.path.endsWith('/timeline')) {
    const prefix = 'matches/';
    const timelineSuffix = '/timeline';
    const matchId = decodeURIComponent(context.path.slice(prefix.length, -timelineSuffix.length));
    const region = asString(context.url.searchParams.get('region'), 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
    const timeline = await provider.getMatchTimeline(region, matchId);
    writeJson(context.res, 200, timeline ?? null);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('matches/')) {
    const matchId = decodeURIComponent(context.path.slice('matches/'.length));
    const region = asString(context.url.searchParams.get('region'), 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
    const detail = await provider.getMatchDetail(region, matchId);
    writeJson(context.res, 200, detail ?? null);
    return true;
  }

  return false;
};
