import type { LinkedAccount, Region } from '../../../domain';
import { callBackendApi } from '../../http-api.client';

export interface LinkAccountInput {
  userId: string;
  region: Region;
  gameName?: string;
  tagLine?: string;
}

export async function linkAccountUseCase(input: LinkAccountInput): Promise<LinkedAccount> {
  try {
    return await callBackendApi<LinkedAccount>({
      path: 'accounts/link',
      method: 'POST',
      body: {
        user_id: input.userId,
        region: input.region,
        game_name: input.gameName,
        tag_line: input.tagLine,
      },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '账号绑定失败';
    throw new Error(mapLinkAccountErrorMessage(raw, input));
  }
}

function mapLinkAccountErrorMessage(raw: string, input: LinkAccountInput): string {
  const accountText = input.gameName && input.tagLine ? `${input.gameName}#${input.tagLine}` : '当前输入账号';

  if (/NETWORK_ERROR|Failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND|ERR_CONNECTION_REFUSED/i.test(raw)) {
    return '无法连接后端服务，请确认后端已启动且 API 地址配置正确。';
  }
  if (/REQUEST_TIMEOUT|aborted|AbortError|timeout/i.test(raw)) {
    return '账号绑定请求超时，请稍后重试。';
  }
  if (/Riot API 401|status_code":401|Forbidden/i.test(raw)) {
    return `Riot 鉴权失败（401/403）。请检查后端 RIOT_API_KEY 配置。原始错误：${raw}`;
  }
  if (/Riot API 404|status_code":404|not found|summoner not found|puuid not found/i.test(raw)) {
    return `未找到账号 ${accountText}，请确认 Riot ID 与 TagLine 完整且区服正确。原始错误：${raw}`;
  }
  if (/Riot API 429|status_code":429|rate limit/i.test(raw)) {
    return `Riot 接口限流，请稍后重试。原始错误：${raw}`;
  }
  if (/Riot API 5\d{2}|status_code":5\d{2}/i.test(raw)) {
    return `Riot 服务暂不可用，请稍后重试。原始错误：${raw}`;
  }
  if (/REAL_ACCOUNT_LINK_DISABLED/i.test(raw)) {
    return '后端未启用 Riot 真实账号接入，请配置 RIOT_PROVIDER_ENABLED=true 和 RIOT_API_KEY。';
  }
  if (/missing.*game.?name|missing.*tag.?line|invalid request/i.test(raw)) {
    return '账号绑定参数不完整，请补充 Riot ID（gameName）与 TagLine。';
  }
  return raw || '账号绑定失败，请稍后重试。';
}
