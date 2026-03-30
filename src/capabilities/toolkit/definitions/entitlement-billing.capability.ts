import type { EntitlementFeature } from '../../../domain';
import { STANDARD_ERROR_SCHEMA, invalidInput, providerError, unauthorized } from '../errors';
import type { CapabilityDefinition } from '../types';

const featureEnum: EntitlementFeature[] = [
  'BASIC_REVIEW',
  'BASIC_GROWTH_SUMMARY',
  'DEEP_REVIEW',
  'AI_FOLLOWUP',
  'CLIP_REVIEW',
];

export interface EntitlementCheckInput {
  userId: string;
  feature_code: EntitlementFeature;
}

export interface EntitlementCheckOutput {
  userId: string;
  feature_code: EntitlementFeature;
  can_access: boolean;
  reason_code: string;
  display_message: string;
  paywall_payload?: import('../../../domain').PaywallPayload;
  remaining_quota?: number;
}

export const entitlementCheckCapability: CapabilityDefinition<
  EntitlementCheckInput,
  EntitlementCheckOutput
> = {
  id: 'entitlement.check',
  title: 'Check feature entitlement',
  inputSchema: {
    type: 'object',
    required: ['userId', 'feature_code'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: {
        type: 'string',
        description: 'Feature code',
        enum: featureEnum,
      },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['userId', 'feature_code', 'can_access', 'reason_code', 'display_message'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code' },
      can_access: { type: 'boolean', description: 'Whether feature can be executed now' },
      reason_code: { type: 'string', description: 'Stable reason code for agent branching' },
      display_message: { type: 'string', description: 'UI-facing explanation' },
      paywall_payload: { type: 'object', description: 'Paywall render payload' },
      remaining_quota: { type: 'number', description: 'Remaining quota for paid feature' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Always callable by agent as pre-check',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.userId) return unauthorized('userId does not match authenticated context');
    if (!input.userId) return invalidInput('userId is required');

    try {
      const decision = await provider.checkFeatureAccess(input.userId, input.feature_code, context.nowIso);
      return {
        ok: true,
        data: {
          userId: input.userId,
          feature_code: input.feature_code,
          ...decision,
        },
      };
    } catch (error) {
      return providerError('Failed to check entitlement', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface EntitlementExplainInput {
  userId: string;
  feature_code: EntitlementFeature;
}

export interface EntitlementExplainOutput {
  userId: string;
  feature_code: EntitlementFeature;
  can_access: boolean;
  reason_code: string;
  display_message: string;
  paywall_payload?: import('../../../domain').PaywallPayload;
  remaining_quota?: number;
  active_entitlements: import('../../../domain').UserEntitlement[];
  active_quotas: import('../../../domain').UsageQuota[];
  available_plans: import('../../../domain').SubscriptionPlan[];
}

export const entitlementExplainCapability: CapabilityDefinition<
  EntitlementExplainInput,
  EntitlementExplainOutput
> = {
  id: 'entitlement.explain',
  title: 'Explain feature entitlement and paywall options',
  inputSchema: {
    type: 'object',
    required: ['userId', 'feature_code'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code', enum: featureEnum },
    },
  },
  outputSchema: {
    type: 'object',
    required: [
      'userId',
      'feature_code',
      'can_access',
      'reason_code',
      'display_message',
      'active_entitlements',
      'active_quotas',
      'available_plans',
    ],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code' },
      can_access: { type: 'boolean', description: 'Access flag' },
      reason_code: { type: 'string', description: 'Reason code' },
      display_message: { type: 'string', description: 'Display text' },
      paywall_payload: { type: 'object', description: 'Paywall payload for frontend shell' },
      remaining_quota: { type: 'number', description: 'Remaining quota if any' },
      active_entitlements: { type: 'array', description: 'Current active entitlement records' },
      active_quotas: { type: 'array', description: 'Current active quota records' },
      available_plans: { type: 'array', description: 'Plans the user can buy for this feature' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Explain gate information to agent and UI',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.userId) return unauthorized('userId does not match authenticated context');
    if (!input.userId) return invalidInput('userId is required');

    try {
      const detail = await provider.explainFeatureAccess(input.userId, input.feature_code, context.nowIso);
      return {
        ok: true,
        data: {
          userId: detail.userId,
          feature_code: detail.featureCode,
          ...detail.decision,
          active_entitlements: detail.activeEntitlements,
          active_quotas: detail.activeQuotas,
          available_plans: detail.availablePlans,
        },
      };
    } catch (error) {
      return providerError('Failed to explain entitlement', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface UsageConsumeInput {
  userId: string;
  feature_code: EntitlementFeature;
  usage_key: string;
  operation_status: 'SUCCESS' | 'FAILED';
}

export interface UsageConsumeOutput {
  userId: string;
  feature_code: EntitlementFeature;
  consumed: boolean;
  reason_code: string;
  display_message: string;
  remaining_quota?: number;
}

export const usageConsumeCapability: CapabilityDefinition<UsageConsumeInput, UsageConsumeOutput> = {
  id: 'usage.consume',
  title: 'Consume feature quota after execution',
  inputSchema: {
    type: 'object',
    required: ['userId', 'feature_code', 'usage_key', 'operation_status'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code', enum: featureEnum },
      usage_key: { type: 'string', description: 'Idempotent usage key' },
      operation_status: { type: 'string', description: 'Task execution result', enum: ['SUCCESS', 'FAILED'] },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['userId', 'feature_code', 'consumed', 'reason_code', 'display_message'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code' },
      consumed: { type: 'boolean', description: 'Whether quota was consumed' },
      reason_code: { type: 'string', description: 'Reason code' },
      display_message: { type: 'string', description: 'Display message' },
      remaining_quota: { type: 'number', description: 'Remaining quota after consumption' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Accounting hook, managed by backend',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.userId) return unauthorized('userId does not match authenticated context');
    if (!input.userId) return invalidInput('userId is required');
    if (!input.usage_key) return invalidInput('usage_key is required');

    try {
      const consumed = await provider.consumeFeatureUsage({
        userId: input.userId,
        featureCode: input.feature_code,
        usageKey: input.usage_key,
        operationStatus: input.operation_status,
        nowIso: context.nowIso,
      });
      return {
        ok: true,
        data: {
          userId: input.userId,
          feature_code: input.feature_code,
          ...consumed,
        },
      };
    } catch (error) {
      return providerError('Failed to consume quota', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface UnlockCreateInput {
  userId: string;
  plan_code: string;
  feature_code?: EntitlementFeature;
}

export interface UnlockCreateOutput {
  order_id: string;
  order_status: string;
  payment_record_id: string;
  provider: 'MOCK_PAY' | 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
  display_message: string;
  paywall_payload: import('../../../domain').PaywallPayload;
}

export const unlockCreateCapability: CapabilityDefinition<UnlockCreateInput, UnlockCreateOutput> = {
  id: 'unlock.create',
  title: 'Create mock unlock order',
  inputSchema: {
    type: 'object',
    required: ['userId', 'plan_code'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      plan_code: { type: 'string', description: 'Plan code' },
      feature_code: { type: 'string', description: 'Optional target feature', enum: featureEnum },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['order_id', 'order_status', 'payment_record_id', 'provider', 'display_message', 'paywall_payload'],
    properties: {
      order_id: { type: 'string', description: 'Order id' },
      order_status: { type: 'string', description: 'Order status' },
      payment_record_id: { type: 'string', description: 'Payment record id' },
      provider: { type: 'string', description: 'Payment provider' },
      display_message: { type: 'string', description: 'Display message' },
      paywall_payload: { type: 'object', description: 'Paywall payload' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Create payment order for unlock',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.userId) return unauthorized('userId does not match authenticated context');
    if (!input.userId) return invalidInput('userId is required');
    if (!input.plan_code) return invalidInput('plan_code is required');

    try {
      const created = await provider.createUnlockOrder({
        userId: input.userId,
        planCode: input.plan_code,
        featureCode: input.feature_code,
        nowIso: context.nowIso,
      });
      if (!created.ok) return invalidInput(created.reason);
      return {
        ok: true,
        data: {
          order_id: created.order.id,
          order_status: created.order.status,
          payment_record_id: created.payment.id,
          provider: created.payment.provider,
          display_message: 'Order created. Continue with unlock.confirm after payment callback.',
          paywall_payload: created.paywall_payload,
        },
      };
    } catch (error) {
      return providerError('Failed to create unlock order', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface UnlockConfirmInput {
  order_id: string;
  transaction_id: string;
}

export interface UnlockConfirmOutput {
  order_id: string;
  order_status: string;
  payment_status: string;
  display_message: string;
  entitlement_state: import('../../../domain').EntitlementState;
}

export const unlockConfirmCapability: CapabilityDefinition<UnlockConfirmInput, UnlockConfirmOutput> = {
  id: 'unlock.confirm',
  title: 'Confirm mock payment callback and refresh entitlement',
  inputSchema: {
    type: 'object',
    required: ['order_id', 'transaction_id'],
    properties: {
      order_id: { type: 'string', description: 'Order id' },
      transaction_id: { type: 'string', description: 'Mock transaction id' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['order_id', 'order_status', 'payment_status', 'display_message', 'entitlement_state'],
    properties: {
      order_id: { type: 'string', description: 'Order id' },
      order_status: { type: 'string', description: 'Order status' },
      payment_status: { type: 'string', description: 'Payment status' },
      display_message: { type: 'string', description: 'Display message' },
      entitlement_state: { type: 'object', description: 'Latest entitlement snapshot' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Payment callback hook',
  },
  async invoke(context, input, provider) {
    if (!input.order_id) return invalidInput('order_id is required');
    if (!input.transaction_id) return invalidInput('transaction_id is required');

    try {
      const confirmed = await provider.confirmUnlockOrder({
        orderId: input.order_id,
        transactionId: input.transaction_id,
        nowIso: context.nowIso,
      });
      if (!confirmed.ok) return invalidInput(confirmed.reason);
      return {
        ok: true,
        data: {
          order_id: confirmed.order.id,
          order_status: confirmed.order.status,
          payment_status: confirmed.payment.status,
          display_message: 'Payment confirmed and entitlement state refreshed.',
          entitlement_state: confirmed.state,
        },
      };
    } catch (error) {
      return providerError('Failed to confirm mock payment', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface BillingUnlockInput {
  userId: string;
  feature_code: EntitlementFeature;
  plan_code: string;
}

export interface BillingUnlockOutput {
  order_id: string;
  order_status: string;
  display_message: string;
}

export const billingUnlockCapability: CapabilityDefinition<BillingUnlockInput, BillingUnlockOutput> = {
  id: 'billing.unlock',
  title: 'Backward-compatible alias of unlock.create',
  inputSchema: {
    type: 'object',
    required: ['userId', 'feature_code', 'plan_code'],
    properties: {
      userId: { type: 'string', description: 'User id' },
      feature_code: { type: 'string', description: 'Feature code', enum: featureEnum },
      plan_code: { type: 'string', description: 'Plan code' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['order_id', 'order_status', 'display_message'],
    properties: {
      order_id: { type: 'string', description: 'Order id' },
      order_status: { type: 'string', description: 'Order status' },
      display_message: { type: 'string', description: 'Display message' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Compatibility bridge for old clients',
  },
  async invoke(context, input, provider) {
    if (context.userId !== input.userId) return unauthorized('userId does not match authenticated context');
    if (!input.userId) return invalidInput('userId is required');

    try {
      const created = await provider.createUnlockOrder({
        userId: input.userId,
        planCode: input.plan_code,
        featureCode: input.feature_code,
        nowIso: context.nowIso,
      });
      if (!created.ok) return invalidInput(created.reason);
      return {
        ok: true,
        data: {
          order_id: created.order.id,
          order_status: created.order.status,
          display_message: 'Order created successfully. Continue with unlock.confirm.',
        },
      };
    } catch (error) {
      return providerError('Failed to create billing unlock order', error instanceof Error ? error.message : 'Unknown');
    }
  },
};
