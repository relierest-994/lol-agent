import { describe, expect, it } from 'vitest';
import { createMockCapabilityRegistry } from '../src/capabilities/toolkit';

function ctx(userId: string) {
  return {
    userId,
    region: 'INTERNATIONAL' as const,
    nowIso: new Date().toISOString(),
    sessionId: `session-${userId}`,
  };
}

async function unlock(registry: ReturnType<typeof createMockCapabilityRegistry>, userId: string, planCode: string, feature: 'DEEP_REVIEW' | 'AI_FOLLOWUP') {
  const created = await registry.invoke({
    id: 'unlock.create',
    context: ctx(userId),
    input: { userId, plan_code: planCode, feature_code: feature },
  });
  expect(created.result.ok).toBe(true);
  if (!created.result.ok) return;
  const orderId = (created.result.data as { order_id: string }).order_id;
  const confirmed = await registry.invoke({
    id: 'unlock.confirm',
    context: ctx(userId),
    input: { order_id: orderId, transaction_id: `txn-${Date.now()}` },
  });
  expect(confirmed.result.ok).toBe(true);
}

describe('Thread-B Deep Review and Match Ask', () => {
  it('supports basic -> deep review chain', async () => {
    const registry = createMockCapabilityRegistry();
    const userId = 'tb-chain';
    const context = ctx(userId);

    await unlock(registry, userId, 'PRO_MONTHLY', 'DEEP_REVIEW');

    const link = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId, region: 'INTERNATIONAL' },
    });
    if (!link.result.ok) return;
    const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId },
    });
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    const basic = await registry.invoke({
      id: 'review.generate_basic',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId, matchId },
    });
    expect(basic.result.ok).toBe(true);

    const deep = await registry.invoke({
      id: 'review.deep.generate',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(deep.result.ok).toBe(true);
  });

  it('returns paywall when deep dependency is required but user lacks deep entitlement', async () => {
    const registry = createMockCapabilityRegistry();
    const userId = 'tb-paywall';
    const context = ctx(userId);

    await unlock(registry, userId, 'FOLLOWUP_PACK_5', 'AI_FOLLOWUP');

    const link = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId, region: 'INTERNATIONAL' },
    });
    if (!link.result.ok) return;
    const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId },
    });
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    const ask = await registry.invoke({
      id: 'review.ask.match',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        match_id: matchId,
        question: '请拆解我这局中期节奏和资源控制为何崩盘',
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(ask.result.ok).toBe(true);
    if (!ask.result.ok) return;
    const data = ask.result.data as { status: string; paywall_action?: { feature_code: string } };
    expect(data.status).toBe('PAYWALL_REQUIRED');
    expect(data.paywall_action?.feature_code).toBe('DEEP_REVIEW');
  });

  it('reuses deep cache and keeps conversation consistency', async () => {
    const registry = createMockCapabilityRegistry();
    const userId = 'tb-cache-conv';
    const context = ctx(userId);

    await unlock(registry, userId, 'PRO_MONTHLY', 'DEEP_REVIEW');
    await unlock(registry, userId, 'FOLLOWUP_PACK_5', 'AI_FOLLOWUP');

    const link = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId, region: 'INTERNATIONAL' },
    });
    if (!link.result.ok) return;
    const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId },
    });
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    const firstDeep = await registry.invoke({
      id: 'review.deep.generate',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    if (!firstDeep.result.ok) return;
    expect((firstDeep.result.data as { cached: boolean }).cached).toBe(false);

    const secondDeep = await registry.invoke({
      id: 'review.deep.generate',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    if (!secondDeep.result.ok) return;
    expect((secondDeep.result.data as { cached: boolean }).cached).toBe(true);

    const askOne = await registry.invoke({
      id: 'review.ask.match',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        match_id: matchId,
        question: '我这局团战处理最大问题是什么？',
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(askOne.result.ok).toBe(true);
    if (!askOne.result.ok) return;
    const one = askOne.result.data as { status: string; cited_from: { deep_review: boolean } };
    expect(one.status).toBe('ANSWERED');
    expect(one.cited_from.deep_review).toBe(true);

    const askTwo = await registry.invoke({
      id: 'review.ask.match',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        match_id: matchId,
        question: '再给我一个下一局可执行的三步方案',
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(askTwo.result.ok).toBe(true);
    if (!askTwo.result.ok) return;
    const two = askTwo.result.data as { status: string; answer?: { summary: string } };
    expect(two.status).toBe('ANSWERED');
    expect(two.answer?.summary).toBeTruthy();
  });
});
