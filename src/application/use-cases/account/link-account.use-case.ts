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
      path: 'accounts/link/mock',
      method: 'POST',
      body: {
        user_id: input.userId,
        region: input.region,
        game_name: input.gameName,
        tag_line: input.tagLine,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '账号绑定失败';
    throw new Error(mapLinkAccountErrorMessage(message));
  }
}

function mapLinkAccountErrorMessage(raw: string): string {
  if (/NETWORK_ERROR|Failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(raw)) {
    return '无法连接后端服务，请确认后端已启动且 VITE_API_BASE_URL 配置正确。';
  }
  if (/REQUEST_TIMEOUT|aborted|AbortError/i.test(raw)) {
    return '账号绑定请求超时，请稍后重试。';
  }
  if (/Riot API 403/i.test(raw)) {
    return 'Riot 鉴权失败（403）。请检查 Riot API Key 是否有效、是否过期，以及区域配置是否正确。';
  }
  if (/Riot API 404/i.test(raw)) {
    return '未找到该 Riot 账号，请检查 Riot ID 和 TagLine 是否正确。';
  }
  if (/Riot API 429/i.test(raw)) {
    return 'Riot 接口触发限流，请稍后重试。';
  }
  if (/Riot API 5\d{2}/i.test(raw)) {
    return 'Riot 服务暂时不可用，请稍后重试。';
  }
  if (/HTTP 500/i.test(raw)) {
    return `服务端处理账号绑定失败：${raw}`;
  }
  return raw;
}

