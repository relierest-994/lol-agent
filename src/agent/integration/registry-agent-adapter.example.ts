import type { Region } from '../../domain';
import { createMockCapabilityRegistry } from '../../capabilities/toolkit';

export async function runBasicReviewByCapabilityRegistry(input: {
  userId: string;
  region: Region;
}) {
  const registry = createMockCapabilityRegistry();
  const context = {
    userId: input.userId,
    nowIso: new Date().toISOString(),
    region: input.region,
    sessionId: `agent-session-${Date.now()}`,
  };

  const regionSelected = await registry.invoke({
    id: 'region.select',
    context,
    input: { region: input.region },
  });
  if (!regionSelected.result.ok) return regionSelected;

  let accountId = '';
  const linkStatus = await registry.invoke({
    id: 'account.link_status',
    context,
    input: { userId: input.userId, region: input.region },
  });

  if (linkStatus.result.ok) {
    const data = linkStatus.result.data as { linked: boolean; account?: { accountId: string } };
    if (data.linked && data.account) accountId = data.account.accountId;
  }

  if (!accountId) {
    const linkMock = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId: input.userId, region: input.region },
    });
    if (!linkMock.result.ok) return linkMock;
    accountId = (linkMock.result.data as { account: { accountId: string } }).account.accountId;
  }

  const recent = await registry.invoke({
    id: 'match.list_recent',
    context,
    input: {
      userId: input.userId,
      region: input.region,
      accountId,
      limit: 10,
    },
  });
  if (!recent.result.ok) return recent;
  const matches = (recent.result.data as { matches: Array<{ matchId: string }> }).matches;

  const selected = await registry.invoke({
    id: 'match.select_target',
    context,
    input: { matches },
  });
  if (!selected.result.ok) return selected;
  const selectedMatchId = (selected.result.data as { selectedMatchId: string }).selectedMatchId;

  return registry.invoke({
    id: 'review.generate_basic',
    context,
    input: {
      userId: input.userId,
      region: input.region,
      accountId,
      matchId: selectedMatchId,
      context: 'agent orchestration example',
    },
  });
}
