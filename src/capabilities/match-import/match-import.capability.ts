import type { Capability } from '../protocol';
import { MatchImportUseCase } from '../../application/use-cases/match-import/match-import.use-case';
import { createMockProviderRegistries } from '../../infrastructure/providers';

const registries = createMockProviderRegistries();
const useCase = new MatchImportUseCase(registries.matchRegistry);

export const matchListCapability: Capability<'match.list'> = {
  name: 'match.list',
  async execute(context, payload) {
    try {
      const list = await useCase.listRecent({
        region: context.region,
        accountId: payload.account.accountId,
        limit: 10,
      });
      const details = await Promise.all(
        list.matches.map(async (item) => {
          const bundle = await useCase.getMatchBundle(context.region, item.matchId);
          return bundle.detail;
        })
      );
      const selected = details[0];

      return {
        ok: true,
        summary: `已获取最近 ${list.matches.length} 场对局`,
        data: { matches: list.matches, details, selected },
      };
    } catch (error) {
      return {
        ok: false,
        summary: '读取对局列表失败',
        error: error instanceof Error ? error.message : 'Unknown match list error',
      };
    }
  },
};

export const pickLatestMatchCapability: Capability<'match.pick-latest'> = {
  name: 'match.pick-latest',
  async execute(_, payload) {
    const selectedMatch = payload.matches[0];
    if (!selectedMatch) {
      return {
        ok: false,
        summary: '未找到可复盘对局',
        error: 'No matches available',
      };
    }

    return {
      ok: true,
      summary: `已选择最近一场：${selectedMatch.matchId}`,
      data: { selectedMatch },
    };
  },
};
