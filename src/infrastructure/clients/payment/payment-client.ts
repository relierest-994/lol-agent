import { HttpClient } from '../http-client';

export interface PaymentCreateCheckoutInput {
  user_id: string;
  order_id: string;
  amount_cents: number;
  currency: 'CNY' | 'USD';
  plan_code: string;
  feature_code?: import('../../../domain').EntitlementFeature;
  return_url: string;
}

export class PaymentClient {
  constructor(private readonly http: HttpClient, private readonly apiKey?: string) {}

  async createCheckoutSession(input: PaymentCreateCheckoutInput): Promise<{
    provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
    payment_intent_id: string;
    checkout_url: string;
    expires_at: string;
  }> {
    return this.http.request({
      path: 'checkout/session',
      method: 'POST',
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      body: input,
    });
  }

  async confirmPayment(input: { order_id: string; transaction_id: string }): Promise<{
    paid: boolean;
    provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
    paid_at?: string;
  }> {
    return this.http.request({
      path: 'checkout/confirm',
      method: 'POST',
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      body: input,
    });
  }
}
