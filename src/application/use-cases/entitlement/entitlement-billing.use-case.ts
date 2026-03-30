import { entitlementBillingService } from '../../services/entitlement-billing.service';
import { paymentWebhookService } from '../../services/payment-webhook.service';
import type { EntitlementFeature } from '../../../domain';
import { callBackendApi } from '../../http-api.client';

export interface EntitlementContextInput {
  userId: string;
  nowIso?: string;
}

function now(nowIso?: string): string {
  return nowIso ?? new Date().toISOString();
}

export async function queryCurrentEntitlements(input: EntitlementContextInput) {
  const nowIso = now(input.nowIso);
  try {
    return await callBackendApi<{
      state: Awaited<ReturnType<typeof entitlementBillingService.getEntitlementState>>;
      snapshot: Awaited<ReturnType<typeof entitlementBillingService.getSnapshot>>;
    }>({
      path: `entitlements/current?user_id=${encodeURIComponent(input.userId)}&now_iso=${encodeURIComponent(nowIso)}`,
      method: 'GET',
    });
  } catch {
    const state = entitlementBillingService.getEntitlementState(input.userId, nowIso);
    const snapshot = entitlementBillingService.getSnapshot(input.userId, nowIso);
    return { state, snapshot };
  }
}

export async function queryFeatureAvailability(input: EntitlementContextInput & { featureCode: EntitlementFeature }) {
  const nowIso = now(input.nowIso);
  try {
    return await callBackendApi<Awaited<ReturnType<typeof entitlementBillingService.check>>>({
      path: 'entitlements/check',
      method: 'POST',
      body: {
        user_id: input.userId,
        feature_code: input.featureCode,
        now_iso: nowIso,
      },
    });
  } catch {
    return entitlementBillingService.check({
      userId: input.userId,
      featureCode: input.featureCode,
      nowIso,
    });
  }
}

export async function createMockOrder(input: {
  userId: string;
  planCode: string;
  featureCode?: EntitlementFeature;
  nowIso?: string;
}) {
  const nowIso = now(input.nowIso);
  try {
    return await callBackendApi<Awaited<ReturnType<typeof entitlementBillingService.createUnlockOrder>>>({
      path: 'payments/order/create',
      method: 'POST',
      body: {
        user_id: input.userId,
        plan_code: input.planCode,
        feature_code: input.featureCode,
        now_iso: nowIso,
      },
    });
  } catch {
    return entitlementBillingService.createUnlockOrder({
      userId: input.userId,
      planCode: input.planCode,
      featureCode: input.featureCode,
      nowIso,
    });
  }
}

export async function confirmMockPayment(input: { orderId: string; transactionId: string; nowIso?: string }) {
  const nowIso = now(input.nowIso);
  try {
    return await callBackendApi<Awaited<ReturnType<typeof entitlementBillingService.confirmUnlock>>>({
      path: 'payments/order/confirm',
      method: 'POST',
      body: {
        order_id: input.orderId,
        transaction_id: input.transactionId,
        now_iso: nowIso,
      },
    });
  } catch {
    return entitlementBillingService.confirmUnlock({
      orderId: input.orderId,
      transactionId: input.transactionId,
      nowIso,
    });
  }
}

export async function createOrder(input: {
  userId: string;
  planCode: string;
  featureCode?: EntitlementFeature;
  nowIso?: string;
}) {
  return createMockOrder(input);
}

export async function confirmPayment(input: { orderId: string; transactionId: string; nowIso?: string }) {
  return confirmMockPayment(input);
}

export async function createPaymentCheckout(input: {
  userId: string;
  orderId: string;
  amountCents: number;
  currency: 'CNY' | 'USD';
  planCode: string;
  featureCode?: EntitlementFeature;
  returnUrl: string;
}) {
  try {
    return await callBackendApi<Awaited<ReturnType<typeof paymentWebhookService.createCheckout>>>({
      path: 'payments/checkout/create',
      method: 'POST',
      body: {
        user_id: input.userId,
        order_id: input.orderId,
        amount_cents: input.amountCents,
        currency: input.currency,
        plan_code: input.planCode,
        feature_code: input.featureCode,
        return_url: input.returnUrl,
      },
    });
  } catch {
    return paymentWebhookService.createCheckout({
      user_id: input.userId,
      order_id: input.orderId,
      amount_cents: input.amountCents,
      currency: input.currency,
      plan_code: input.planCode,
      feature_code: input.featureCode,
      return_url: input.returnUrl,
    });
  }
}

export async function handlePaymentCallback(input: {
  provider: 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
  eventId: string;
  orderId: string;
  transactionId: string;
  status: 'SUCCEEDED' | 'FAILED';
  amountCents: number;
  currency: string;
  timestamp: string;
  signature: string;
  rawPayload: Record<string, unknown>;
  nowIso?: string;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  try {
    return await callBackendApi<Awaited<ReturnType<typeof paymentWebhookService.handleCallback>>>({
      path: 'payments/callback',
      method: 'POST',
      body: {
        provider: input.provider,
        event_id: input.eventId,
        order_id: input.orderId,
        transaction_id: input.transactionId,
        status: input.status,
        amount_cents: input.amountCents,
        currency: input.currency,
        timestamp: input.timestamp,
        signature: input.signature,
        raw_payload: input.rawPayload,
        now_iso: nowIso,
      },
    });
  } catch {
    return paymentWebhookService.handleCallback({
      provider: input.provider,
      event_id: input.eventId,
      order_id: input.orderId,
      transaction_id: input.transactionId,
      status: input.status,
      amount_cents: input.amountCents,
      currency: input.currency,
      timestamp: input.timestamp,
      signature: input.signature,
      raw_payload: input.rawPayload,
      nowIso,
    });
  }
}
