import { asString, readRequestBody, writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

function mapError(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (message === 'INVALID_PHONE_NUMBER') {
    return { status: 400, code: message, message: '手机号格式不正确，请输入 11 位手机号。' };
  }
  if (message.startsWith('VERIFICATION_CODE')) {
    const mappedMessage =
      message === 'VERIFICATION_CODE_INVALID'
        ? '验证码错误，请重新输入。'
        : message === 'VERIFICATION_CODE_EXPIRED'
          ? '验证码已过期，请重新获取。'
          : message === 'VERIFICATION_CODE_USED'
            ? '验证码已使用，请重新获取。'
            : '请先获取验证码。';
    return { status: 400, code: message, message: mappedMessage };
  }
  if (message === 'NICKNAME_REQUIRED') {
    return { status: 400, code: message, message: '请先填写昵称。' };
  }
  if (message === 'APP_USER_NOT_FOUND') {
    return { status: 404, code: message, message: '用户不存在，请重新登录。' };
  }
  if (message === 'HERO_NOT_FOUND') {
    return { status: 404, code: message, message: '未找到该英雄，请刷新后重试。' };
  }
  if (message === 'ITEM_NOT_FOUND') {
    return { status: 404, code: message, message: '未找到该装备，请刷新后重试。' };
  }
  if (message === 'RUNE_NOT_FOUND') {
    return { status: 404, code: message, message: '未找到该天赋，请刷新后重试。' };
  }
  if (/schema .* does not exist|不存在|relation .* does not exist|未找到关系/i.test(message)) {
    return { status: 503, code: 'DB_SCHEMA_MISSING', message: '数据库 schema 或数据表不存在，请先建库建表。' };
  }
  if (/DB query failed|persistent_state_kv|permission denied|insufficient privilege|权限不够|无权限/i.test(message)) {
    return { status: 503, code: 'DB_UNAVAILABLE', message: '数据库暂不可用，请检查 DB 配置、schema 权限后重试。' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试。' };
}

export const handleAppShellRoutes: RouteHandler = async (context, services) => {
  const { appShellService } = services;

  if (context.method === 'POST' && context.path === 'app/auth/send-code') {
    try {
      const body = await readRequestBody(context);
      const response = await appShellService.sendLoginCode(asString(body.phone));
      writeJson(context.res, 200, response);
    } catch (error) {
      console.error('[app-shell] send-code failed:', error instanceof Error ? error.message : String(error));
      const mapped = mapError(error);
      writeJson(context.res, mapped.status, mapped);
    }
    return true;
  }

  if (context.method === 'POST' && context.path === 'app/auth/login') {
    try {
      const body = await readRequestBody(context);
      const response = await appShellService.loginWithCode({
        phoneRaw: asString(body.phone),
        verificationCode: asString(body.verification_code),
      });
      writeJson(context.res, 200, response);
    } catch (error) {
      console.error('[app-shell] login failed:', error instanceof Error ? error.message : String(error));
      const mapped = mapError(error);
      writeJson(context.res, mapped.status, mapped);
    }
    return true;
  }

  if (context.method === 'POST' && context.path === 'app/profile/setup') {
    try {
      const body = await readRequestBody(context);
      const profile = await appShellService.setupProfile({
        userId: asString(body.user_id),
        nickname: asString(body.nickname),
        avatarUrl: asString(body.avatar_url) || undefined,
      });
      writeJson(context.res, 200, profile);
    } catch (error) {
      console.error('[app-shell] profile setup failed:', error instanceof Error ? error.message : String(error));
      const mapped = mapError(error);
      writeJson(context.res, mapped.status, mapped);
    }
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/profile') {
    const userId = asString(context.url.searchParams.get('user_id'));
    const profile = await appShellService.getProfile(userId);
    if (!profile) {
      writeJson(context.res, 404, {
        code: 'APP_USER_NOT_FOUND',
        message: '用户不存在，请重新登录。',
      });
      return true;
    }
    writeJson(context.res, 200, profile);
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/dashboard/home') {
    const userId = asString(context.url.searchParams.get('user_id'));
    const data = await appShellService.getHomeDashboard(userId);
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/dashboard/data-center') {
    const userId = asString(context.url.searchParams.get('user_id'));
    const data = await appShellService.getDataCenter(userId);
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/heroes') {
    const position = asString(context.url.searchParams.get('position'), 'ALL') as 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ALL';
    const changeTag = asString(context.url.searchParams.get('change_tag'), 'ALL') as 'ALL' | 'BUFF' | 'NERF' | 'NEUTRAL';
    const data = await appShellService.getHeroesDashboard({ position, changeTag });
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('app/heroes/')) {
    const championId = decodeURIComponent(context.path.slice('app/heroes/'.length));
    const detail = await appShellService.getHeroDetail({ championId });
    if (!detail) {
      writeJson(context.res, 404, {
        code: 'HERO_NOT_FOUND',
        message: '未找到该英雄，请刷新后重试。',
      });
      return true;
    }
    writeJson(context.res, 200, detail);
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/items') {
    const changeTag = asString(context.url.searchParams.get('change_tag'), 'ALL') as 'ALL' | 'BUFF' | 'NERF' | 'NEUTRAL';
    const data = await appShellService.getItemsDashboard({ changeTag });
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('app/items/')) {
    const itemId = decodeURIComponent(context.path.slice('app/items/'.length));
    const detail = await appShellService.getItemDetail({ itemId });
    if (!detail) {
      writeJson(context.res, 404, {
        code: 'ITEM_NOT_FOUND',
        message: '未找到该装备，请刷新后重试。',
      });
      return true;
    }
    writeJson(context.res, 200, detail);
    return true;
  }

  if (context.method === 'GET' && context.path === 'app/runes') {
    const changeTag = asString(context.url.searchParams.get('change_tag'), 'ALL') as 'ALL' | 'BUFF' | 'NERF' | 'NEUTRAL';
    const data = await appShellService.getRunesDashboard({ changeTag });
    writeJson(context.res, 200, data);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('app/runes/')) {
    const runeId = decodeURIComponent(context.path.slice('app/runes/'.length));
    const detail = await appShellService.getRuneDetail({ runeId });
    if (!detail) {
      writeJson(context.res, 404, {
        code: 'RUNE_NOT_FOUND',
        message: '未找到该天赋，请刷新后重试。',
      });
      return true;
    }
    writeJson(context.res, 200, detail);
    return true;
  }

  return false;
};
