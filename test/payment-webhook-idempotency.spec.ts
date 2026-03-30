import { describe, expect, it } from 'vitest';
import { createMockOrder } from '../src/application';
import { PaymentWebhookService } from '../src/application/services/payment-webhook.service';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';
import { SkeletonPaymentProvider } from '../src/infrastructure/payments/skeleton-payment.provider';
import { buildPaymentSignature } from '../src/infrastructure/payments/payment-signature';

describe('Payment webhook idempotency', () => {
  it('verifies signature and enforces callback idempotency', async () => {
    clearPersistentState('billing-repository');
    clearPersistentState('payment-webhook-idempotency');
    const nowIso = new Date().toISOString();
    const created = await createMockOrder({
      userId: 'pay-u1',
      planCode: 'DEEP_SINGLE',
      featureCode: 'DEEP_REVIEW',
      nowIso,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const secret = 'unit-test-secret';
    const provider = new SkeletonPaymentProvider(secret, 'STRIPE');
    const service = new PaymentWebhookService(provider);

    const payload = {
      provider: 'STRIPE' as const,
      event_id: 'evt-001',
      order_id: created.order.id,
      transaction_id: 'txn-001',
      status: 'SUCCEEDED' as const,
      amount_cents: created.order.amountCents,
      currency: created.order.currency,
      timestamp: String(Date.now()),
    };
    const signature = await buildPaymentSignature(secret, payload);

    const first = await service.handleCallback({
      ...payload,
      signature,
      raw_payload: payload,
      nowIso,
    });
    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);

    const second = await service.handleCallback({
      ...payload,
      signature,
      raw_payload: payload,
      nowIso,
    });
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
  });
});
