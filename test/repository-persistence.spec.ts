import { describe, expect, it } from 'vitest';
import { MockBillingRepository } from '../src/infrastructure/repositories/mock-billing.repository';
import { MockDeepReviewRepository } from '../src/infrastructure/repositories/mock-deep-review.repository';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';

describe('Persistent repositories', () => {
  it('persists billing state across repository instances', () => {
    clearPersistentState('billing-repository');
    const nowIso = new Date().toISOString();
    const repo1 = new MockBillingRepository();
    const order = repo1.createOrder({
      userId: 'persist-billing-u1',
      planCode: 'FOLLOWUP_PACK_5',
      featureCode: 'AI_FOLLOWUP',
      nowIso,
    });
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    repo1.confirmPayment({
      orderId: order.order.id,
      transactionId: 'txn-persist-1',
      nowIso,
    });

    const repo2 = new MockBillingRepository();
    const decision = repo2.checkAccess('persist-billing-u1', 'AI_FOLLOWUP', nowIso);
    expect(decision.can_access).toBe(true);
  });

  it('persists deep review results across instances', () => {
    clearPersistentState('deep-review-repository');
    const nowIso = new Date().toISOString();
    const repo1 = new MockDeepReviewRepository();
    const task = repo1.createTask(
      {
        user_id: 'persist-deep-u1',
        match_id: 'EUW-1001',
        status: 'COMPLETED',
        focus_dimensions: ['LANING'],
        authorization_context: { entitlement_checked: true },
      },
      nowIso
    );
    repo1.saveResult({
      task_id: task.task_id,
      user_id: 'persist-deep-u1',
      match_id: 'EUW-1001',
      status: 'COMPLETED',
      dimensions: ['LANING'],
      structured_insights: [],
      evidence_list: [],
      suggestion_list: [],
      render_payload: { sections: [], summary: 'persisted summary' },
      generated_at: nowIso,
      cached: false,
    });

    const repo2 = new MockDeepReviewRepository();
    const result = repo2.getLatestResult('persist-deep-u1', 'EUW-1001');
    expect(result?.render_payload.summary).toBe('persisted summary');
  });
});
