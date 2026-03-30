import { describe, expect, it } from 'vitest';
import { createMockCapabilityRegistry } from '../src/capabilities/toolkit';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';
import { pollDeepReviewTask, pollVideoDiagnosisTask } from '../src/presentation/app-shell/agent-shell-runtime';
import { confirmPayment, createOrder, createPaymentCheckout, queryCurrentEntitlements } from '../src/application';

function ctx(userId: string, region: 'INTERNATIONAL' | 'CN' = 'INTERNATIONAL') {
  return {
    userId,
    region,
    nowIso: new Date().toISOString(),
    sessionId: `session-${userId}`,
  };
}

describe('Frontend realtime adapter', () => {
  it('polls deep review and diagnosis tasks under async flow', async () => {
    clearPersistentState('job-queue-runtime');
    clearPersistentState('video-diagnosis-repository');
    clearPersistentState('deep-review-repository');
    clearPersistentState('billing-repository');

    const registry = createMockCapabilityRegistry();
    const userId = 'ui-runtime-u1';
    const context = ctx(userId);

    const deepUnlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId, plan_code: 'PRO_MONTHLY', feature_code: 'DEEP_REVIEW' },
    });
    if (!deepUnlock.result.ok) return;
    const deepOrder = deepUnlock.result.data as { order_id: string };
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: deepOrder.order_id, transaction_id: 'txn-ui-deep' },
    });

    const clipUnlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId, plan_code: 'CLIP_PACK_3', feature_code: 'CLIP_REVIEW' },
    });
    if (!clipUnlock.result.ok) return;
    const clipOrder = clipUnlock.result.data as { order_id: string };
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: clipOrder.order_id, transaction_id: 'txn-ui-clip' },
    });

    const linked = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId, region: 'INTERNATIONAL' },
    });
    if (!linked.result.ok) return;
    const accountId = (linked.result.data as { account: { accountId: string } }).account.accountId;

    const recent = await registry.invoke({
      id: 'match.list_recent',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId, limit: 1 },
    });
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    await registry.invoke({
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

    const deepPoll = await pollDeepReviewTask({
      userId,
      region: 'INTERNATIONAL',
      matchId,
    });
    expect(['COMPLETED', 'PENDING', 'RUNNING']).toContain(deepPoll.status);

    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: userId,
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 1024 * 1024,
        duration_seconds: 18,
      },
    });
    if (!upload.result.ok) return;
    const uploaded = upload.result.data as { asset_id: string };

    const created = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        match_id: matchId,
        asset_id: uploaded.asset_id,
        natural_language_question: 'why this skirmish failed',
        entitlement_context: { entitlement_checked: true },
      },
    });
    if (!created.result.ok) return;
    const createdTask = created.result.data as { task_id: string };

    const diagnosisPoll = await pollVideoDiagnosisTask({
      userId,
      region: 'INTERNATIONAL',
      taskId: createdTask.task_id,
      matchId,
      assetId: uploaded.asset_id,
    });
    expect(['COMPLETED', 'PENDING', 'RUNNING']).toContain(diagnosisPoll.status);
  });

  it('refreshes entitlement after checkout + payment confirmation', async () => {
    clearPersistentState('billing-repository');
    clearPersistentState('payment-skeleton-provider');
    const userId = 'ui-payment-u1';

    const before = await queryCurrentEntitlements({ userId });
    expect(before.state.features.DEEP_REVIEW).toBe(false);

    const created = await createOrder({
      userId,
      planCode: 'DEEP_SINGLE',
      featureCode: 'DEEP_REVIEW',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const checkout = await createPaymentCheckout({
      userId,
      orderId: created.order.id,
      amountCents: created.order.amountCents,
      currency: created.order.currency,
      planCode: 'DEEP_SINGLE',
      featureCode: 'DEEP_REVIEW',
      returnUrl: 'https://example.com/return',
    });
    expect(checkout.checkout_url.length).toBeGreaterThan(0);

    const confirmed = await confirmPayment({
      orderId: created.order.id,
      transactionId: 'txn-ui-payment',
    });
    expect(confirmed.ok).toBe(true);

    const after = await queryCurrentEntitlements({ userId });
    expect(after.state.features.DEEP_REVIEW).toBe(true);
  });
});
