import type { EntitlementFeature } from '../../domain';

export interface PaymentCheckoutRequest {
  user_id: string;
  order_id: string;
  amount_cents: number;
  currency: 'CNY' | 'USD';
  plan_code: string;
  feature_code?: EntitlementFeature;
  return_url: string;
}

export interface PaymentCheckoutResponse {
  provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
  payment_intent_id: string;
  checkout_url: string;
  expires_at: string;
  signature: string;
  nonce: string;
  timestamp: string;
}

export interface PaymentWebhookInput {
  provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
  event_id: string;
  order_id: string;
  transaction_id: string;
  status: 'SUCCEEDED' | 'FAILED';
  amount_cents: number;
  currency: string;
  timestamp: string;
  signature: string;
  raw_payload: Record<string, unknown>;
}

export interface PaymentProvider {
  createCheckout(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse>;
  verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean>;
}
