import { createPersistentStateStore } from '../persistence/persistent-state.store';
import type { PaymentCheckoutRequest, PaymentCheckoutResponse, PaymentProvider, PaymentWebhookInput } from './payment-provider';
import { buildPaymentSignature, verifyPaymentSignature } from './payment-signature';

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function plusMinutes(nowIso: string, minutes: number): string {
  const date = new Date(nowIso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

export class SkeletonPaymentProvider implements PaymentProvider {
  private readonly store = createPersistentStateStore('payment-skeleton-provider');

  constructor(private readonly secret: string, private readonly provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY' = 'STRIPE') {}

  async createCheckout(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse> {
    const nowIso = new Date().toISOString();
    const timestamp = String(Date.now());
    const nonce = randomId('nonce');
    const checkout = {
      provider: this.provider,
      payment_intent_id: randomId('pi'),
      checkout_url: `https://pay.example.com/checkout/${request.order_id}`,
      expires_at: plusMinutes(nowIso, 30),
      nonce,
      timestamp,
    };
    const signature = await buildPaymentSignature(this.secret, {
      order_id: request.order_id,
      payment_intent_id: checkout.payment_intent_id,
      timestamp,
      nonce,
      amount_cents: request.amount_cents,
      currency: request.currency,
    });
    this.store.write(`checkout:${request.order_id}`, {
      ...checkout,
      signature,
      request,
      created_at: nowIso,
    });
    return {
      ...checkout,
      signature,
    };
  }

  async verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean> {
    return verifyPaymentSignature({
      secret: this.secret,
      payload: {
        provider: input.provider,
        event_id: input.event_id,
        order_id: input.order_id,
        transaction_id: input.transaction_id,
        status: input.status,
        amount_cents: input.amount_cents,
        currency: input.currency,
        timestamp: input.timestamp,
      },
      signature: input.signature,
    });
  }
}
