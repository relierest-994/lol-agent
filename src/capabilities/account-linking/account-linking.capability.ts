import type { Capability } from '../protocol';
import { createMockProviderRegistries } from '../../infrastructure/providers';

const registries = createMockProviderRegistries();

export const accountLinkCapability: Capability<'account.link'> = {
  name: 'account.link',
  async execute(context, payload) {
    try {
      if (payload.linkedAccount) {
        return {
          ok: true,
          summary: `账号已接入：${payload.linkedAccount.gameName}#${payload.linkedAccount.tagLine}`,
          data: { account: payload.linkedAccount },
        };
      }

      const provider = registries.accountRegistry.get(context.region);
      const account = await provider.linkAccountMock(context.userId);
      return {
        ok: true,
        summary: `已完成 ${context.region} 账号接入（${provider.providerId}）`,
        data: { account },
      };
    } catch (error) {
      return {
        ok: false,
        summary: '账号接入失败',
        error: error instanceof Error ? error.message : 'Unknown account linking error',
      };
    }
  },
};
