import { asString, readRequestBody, writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

export const handleEntitlementPaymentRoutes: RouteHandler = async (context, services) => {
  const { provider, paymentWebhookService } = services;

  if (context.method === 'GET' && context.path === 'entitlements/current') {
    const userId = asString(context.url.searchParams.get('user_id'));
    const nowIso = asString(context.url.searchParams.get('now_iso'), new Date().toISOString());
    const state = await provider.getEntitlement(userId);
    const snapshot = await provider.getBillingSnapshot(userId, nowIso);
    writeJson(context.res, 200, { state, snapshot });
    return true;
  }

  if (context.method === 'GET' && context.path === 'entitlements/state') {
    const state = await provider.getEntitlement(asString(context.url.searchParams.get('user_id')));
    writeJson(context.res, 200, state);
    return true;
  }

  if (context.method === 'POST' && context.path === 'entitlements/check') {
    const body = await readRequestBody(context);
    const decision = await provider.checkFeatureAccess(
      asString(body.user_id),
      asString(body.feature_code) as never,
      asString(body.now_iso, new Date().toISOString())
    );
    writeJson(context.res, 200, decision);
    return true;
  }

  if (context.method === 'POST' && context.path === 'entitlements/explain') {
    const body = await readRequestBody(context);
    const explained = await provider.explainFeatureAccess(
      asString(body.user_id),
      asString(body.feature_code) as never,
      asString(body.now_iso, new Date().toISOString())
    );
    writeJson(context.res, 200, explained);
    return true;
  }

  if (context.method === 'POST' && context.path === 'entitlements/consume') {
    const body = await readRequestBody(context);
    const consumed = await provider.consumeFeatureUsage({
      userId: asString(body.user_id),
      featureCode: asString(body.feature_code) as never,
      usageKey: asString(body.usage_key),
      operationStatus: asString(body.operation_status, 'FAILED') as 'SUCCESS' | 'FAILED',
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, consumed);
    return true;
  }

  if (context.method === 'POST' && context.path === 'payments/order/create') {
    const body = await readRequestBody(context);
    const created = await provider.createUnlockOrder({
      userId: asString(body.user_id),
      planCode: asString(body.plan_code),
      featureCode: (body.feature_code as never) ?? undefined,
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, created);
    return true;
  }

  if (context.method === 'POST' && context.path === 'payments/order/confirm') {
    const body = await readRequestBody(context);
    const confirmed = await provider.confirmUnlockOrder({
      orderId: asString(body.order_id),
      transactionId: asString(body.transaction_id),
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, confirmed);
    return true;
  }

  if (context.method === 'POST' && context.path === 'payments/checkout/create') {
    const body = await readRequestBody(context);
    const checkout = await paymentWebhookService.createCheckout({
      user_id: asString(body.user_id),
      order_id: asString(body.order_id),
      amount_cents: Number(body.amount_cents ?? 0),
      currency: asString(body.currency, 'CNY') as 'CNY' | 'USD',
      plan_code: asString(body.plan_code),
      feature_code: body.feature_code as never,
      return_url: asString(body.return_url),
    });
    writeJson(context.res, 200, checkout);
    return true;
  }

  if (context.method === 'POST' && context.path === 'payments/callback') {
    const body = await readRequestBody(context);
    const callback = await paymentWebhookService.handleCallback({
      provider: asString(body.provider, 'STRIPE') as 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY',
      event_id: asString(body.event_id),
      order_id: asString(body.order_id),
      transaction_id: asString(body.transaction_id),
      status: asString(body.status, 'FAILED') as 'SUCCEEDED' | 'FAILED',
      amount_cents: Number(body.amount_cents ?? 0),
      currency: asString(body.currency, 'CNY'),
      timestamp: asString(body.timestamp, new Date().toISOString()),
      signature: asString(body.signature),
      raw_payload: (body.raw_payload as Record<string, unknown>) ?? {},
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, callback);
    return true;
  }

  if (context.method === 'POST' && context.path === 'payments/snapshot') {
    const body = await readRequestBody(context);
    const snapshot = await provider.getBillingSnapshot(
      asString(body.user_id),
      asString(body.now_iso, new Date().toISOString())
    );
    writeJson(context.res, 200, snapshot);
    return true;
  }

  return false;
};

