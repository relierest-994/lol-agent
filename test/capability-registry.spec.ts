import { describe, expect, it } from 'vitest';
import { createMockCapabilityRegistry } from '../src/capabilities/toolkit';

function context(userId = 'cap-u1', region: 'INTERNATIONAL' | 'CN' = 'INTERNATIONAL') {
  return {
    userId,
    region,
    nowIso: new Date().toISOString(),
    sessionId: 'session-cap-test',
  };
}

describe('CapabilityRegistry Toolkit', () => {
  it('registers all required capabilities and returns metadata', () => {
    const registry = createMockCapabilityRegistry();
    const ids = registry.list().map((item) => item.id);

    expect(ids).toEqual([
      'account.link_status',
      'account.link_mock',
      'region.select',
      'match.list_recent',
      'match.select_target',
      'asset.video.upload',
      'diagnosis.video.create',
      'diagnosis.video.status',
      'diagnosis.video.get',
      'review.generate_basic',
      'entitlement.check',
      'entitlement.explain',
      'usage.consume',
      'review.deep.generate',
      'review.deep.get',
      'review.deep.status',
      'review.generate_deep',
      'review.ask.match',
      'review.ask.suggested_prompts',
      'review.ask_followup',
      'review.analyze_clip',
      'unlock.create',
      'unlock.confirm',
      'billing.unlock',
    ]);
  });

  it('can generate deep review and reuse cache', async () => {
    const registry = createMockCapabilityRegistry();
    const ctx = context('deep-u1', 'CN');

    const link = await registry.invoke({
      id: 'account.link_mock',
      context: ctx,
      input: { userId: 'deep-u1', region: 'CN' },
    });
    expect(link.result.ok).toBe(true);
    if (!link.result.ok) return;
    const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context: ctx,
      input: { userId: 'deep-u1', region: 'CN', accountId },
    });
    expect(recent.result.ok).toBe(true);
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    expect(matchId).toBeDefined();
    if (!matchId) return;

    const created = await registry.invoke({
      id: 'unlock.create',
      context: ctx,
      input: { userId: 'deep-u1', plan_code: 'PRO_MONTHLY', feature_code: 'DEEP_REVIEW' },
    });
    expect(created.result.ok).toBe(true);
    if (!created.result.ok) return;
    const orderId = (created.result.data as { order_id: string }).order_id;

    const confirmed = await registry.invoke({
      id: 'unlock.confirm',
      context: ctx,
      input: { order_id: orderId, transaction_id: 'txn-deep-cap' },
    });
    expect(confirmed.result.ok).toBe(true);

    const first = await registry.invoke({
      id: 'review.deep.generate',
      context: ctx,
      input: {
        user_id: 'deep-u1',
        region: 'CN',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(first.result.ok).toBe(true);
    if (!first.result.ok) return;
    expect((first.result.data as { status: string }).status).toBe('COMPLETED');

    const second = await registry.invoke({
      id: 'review.deep.generate',
      context: ctx,
      input: {
        user_id: 'deep-u1',
        region: 'CN',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(second.result.ok).toBe(true);
    if (!second.result.ok) return;
    expect((second.result.data as { cached: boolean }).cached).toBe(true);
  });

  it('supports follow-up answer and suggested prompts bound to match context', async () => {
    const registry = createMockCapabilityRegistry();
    const ctx = context('ask-u1');

    const link = await registry.invoke({
      id: 'account.link_mock',
      context: ctx,
      input: { userId: 'ask-u1', region: 'INTERNATIONAL' },
    });
    expect(link.result.ok).toBe(true);
    if (!link.result.ok) return;
    const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context: ctx,
      input: { userId: 'ask-u1', region: 'INTERNATIONAL', accountId },
    });
    expect(recent.result.ok).toBe(true);
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    const unlockAsk = await registry.invoke({
      id: 'unlock.create',
      context: ctx,
      input: { userId: 'ask-u1', plan_code: 'FOLLOWUP_PACK_5', feature_code: 'AI_FOLLOWUP' },
    });
    expect(unlockAsk.result.ok).toBe(true);
    if (!unlockAsk.result.ok) return;
    const askOrderId = (unlockAsk.result.data as { order_id: string }).order_id;
    const askConfirm = await registry.invoke({
      id: 'unlock.confirm',
      context: ctx,
      input: { order_id: askOrderId, transaction_id: 'txn-ask-cap' },
    });
    expect(askConfirm.result.ok).toBe(true);

    const answer = await registry.invoke({
      id: 'review.ask.match',
      context: ctx,
      input: {
        user_id: 'ask-u1',
        region: 'INTERNATIONAL',
        match_id: matchId,
        question: '这局我前中期最亏的一波是什么？',
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(answer.result.ok).toBe(true);
    if (!answer.result.ok) return;
    expect((answer.result.data as { status: string }).status).toBeDefined();

    const prompts = await registry.invoke({
      id: 'review.ask.suggested_prompts',
      context: ctx,
      input: { user_id: 'ask-u1', match_id: matchId },
    });
    expect(prompts.result.ok).toBe(true);
    if (!prompts.result.ok) return;
    expect((prompts.result.data as { prompts: string[] }).prompts.length).toBeGreaterThan(0);
  });
});
