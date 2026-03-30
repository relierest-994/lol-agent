import { entitlementBillingService } from './entitlement-billing.service';
import { createPersistentStateStore } from '../../infrastructure/persistence/persistent-state.store';
import type { PaymentProvider, PaymentWebhookInput } from '../../infrastructure/payments/payment-provider';
import { SkeletonPaymentProvider } from '../../infrastructure/payments/skeleton-payment.provider';

function resolveWebhookSecret(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return env.PAYMENT_WEBHOOK_SECRET ?? 'dev-payment-webhook-secret';
}

function resolveProviderType(): 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY' {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const raw = env.PAYMENT_PROVIDER ?? 'STRIPE';
  if (raw === 'ALIPAY' || raw === 'WECHAT_PAY') return raw;
  return 'STRIPE';
}

export class PaymentWebhookService {
  private readonly idempotencyStore = createPersistentStateStore('payment-webhook-idempotency');

  constructor(
    private readonly provider: PaymentProvider = new SkeletonPaymentProvider(resolveWebhookSecret(), resolveProviderType())
  ) {}

  async createCheckout(input: {
    user_id: string;
    order_id: string;
    amount_cents: number;
    currency: 'CNY' | 'USD';
    plan_code: string;
    feature_code?: import('../../domain').EntitlementFeature;
    return_url: string;
  }) {
    return this.provider.createCheckout(input);
  }

  async handleCallback(input: PaymentWebhookInput & { nowIso: string }): Promise<{
    ok: boolean;
    idempotent: boolean;
    reason?: string;
  }> {
    const verified = await this.provider.verifyWebhookSignature(input);
    if (!verified) {
      return { ok: false, idempotent: false, reason: 'invalid_signature' };
    }

    const idempotencyKey = `${input.provider}:${input.event_id}`;
    const alreadyProcessed = this.idempotencyStore.read<boolean>(`event:${idempotencyKey}`);
    if (alreadyProcessed) {
      return { ok: true, idempotent: true };
    }

    if (input.status !== 'SUCCEEDED') {
      this.idempotencyStore.write(`event:${idempotencyKey}`, true);
      return { ok: true, idempotent: false };
    }

    const confirmed = entitlementBillingService.confirmUnlock({
      orderId: input.order_id,
      transactionId: input.transaction_id,
      nowIso: input.nowIso,
    });
    if (!confirmed.ok) {
      return { ok: false, idempotent: false, reason: confirmed.reason };
    }

    this.idempotencyStore.write(`event:${idempotencyKey}`, true);
    return { ok: true, idempotent: false };
  }
}

export const paymentWebhookService = new PaymentWebhookService();
