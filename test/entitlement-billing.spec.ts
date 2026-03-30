import { describe, expect, it } from 'vitest';
import {
  confirmMockPayment,
  createMockOrder,
  queryCurrentEntitlements,
  queryFeatureAvailability,
} from '../src/application';

describe('Entitlement / Billing Service', () => {
  it('keeps free feature always accessible', async () => {
    const feature = await queryFeatureAvailability({
      userId: 'boundary-free',
      featureCode: 'BASIC_REVIEW',
    });

    expect(feature.can_access).toBe(true);
    expect(feature.reason_code).toBe('FEATURE_FREE');
  });

  it('blocks paid features before purchase', async () => {
    const deep = await queryFeatureAvailability({
      userId: 'boundary-paid',
      featureCode: 'DEEP_REVIEW',
    });

    expect(deep.can_access).toBe(false);
    expect(deep.paywall_payload?.plans.length).toBeGreaterThan(0);
  });

  it('refreshes entitlement state after mock payment callback', async () => {
    const userId = 'pay-refresh-user';
    const before = await queryFeatureAvailability({ userId, featureCode: 'CLIP_REVIEW' });
    expect(before.can_access).toBe(false);

    const order = await createMockOrder({ userId, featureCode: 'CLIP_REVIEW', planCode: 'CLIP_PACK_3' });
    expect(order.ok).toBe(true);
    if (!order.ok) return;

    const confirmed = await confirmMockPayment({
      orderId: order.order.id,
      transactionId: 'txn-refresh',
    });
    expect(confirmed.ok).toBe(true);

    const after = await queryFeatureAvailability({ userId, featureCode: 'CLIP_REVIEW' });
    expect(after.can_access).toBe(true);

    const snapshot = await queryCurrentEntitlements({ userId });
    expect(snapshot.state.features.CLIP_REVIEW).toBe(true);
  });

  it('does not mutate quota when payment confirmation fails', async () => {
    const failed = await confirmMockPayment({ orderId: 'ord-not-exists', transactionId: 'txn-fail' });
    expect(failed.ok).toBe(false);

    const state = await queryCurrentEntitlements({ userId: 'rollback-user' });
    expect(state.state.remainingQuota.AI_FOLLOWUP).toBeUndefined();
    expect(state.state.features.AI_FOLLOWUP).toBe(false);
  });
});
