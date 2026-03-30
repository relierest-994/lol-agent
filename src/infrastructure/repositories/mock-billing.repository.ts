import type {
  EntitlementDecision,
  EntitlementFeature,
  EntitlementState,
  FeatureGate,
  PaywallPayload,
  PaymentRecord,
  PurchaseOrder,
  ReasonCode,
  SubscriptionPlan,
  UnlockRecord,
  UsageQuota,
  UserEntitlement,
} from '../../domain';
import { createPersistentStateStore, type PersistentStateStore } from '../persistence/persistent-state.store';
import { loadRuntimeConfig } from '../config/runtime-config';

interface CreateOrderInput {
  userId: string;
  planCode: string;
  featureCode?: EntitlementFeature;
  nowIso: string;
}

interface ConfirmPaymentInput {
  orderId: string;
  transactionId: string;
  nowIso: string;
}

interface ConsumeUsageInput {
  userId: string;
  featureCode: EntitlementFeature;
  usageKey: string;
  operationStatus: 'SUCCESS' | 'FAILED';
  nowIso: string;
}

interface ConsumeUsageResult {
  consumed: boolean;
  reason_code: ReasonCode;
  display_message: string;
  remaining_quota?: number;
}

export interface EntitlementRepositorySnapshot {
  userId: string;
  gates: FeatureGate[];
  plans: SubscriptionPlan[];
  entitlements: UserEntitlement[];
  quotas: UsageQuota[];
  orders: PurchaseOrder[];
  payments: PaymentRecord[];
  unlocks: UnlockRecord[];
}

const runtimeConfig = loadRuntimeConfig();
const AI_FOLLOWUP_PAID = runtimeConfig.aiFollowupPaid;
const CLIP_REVIEW_PAID = runtimeConfig.clipReviewPaid;

const FREE_FEATURES: EntitlementFeature[] = [
  'BASIC_REVIEW',
  'BASIC_GROWTH_SUMMARY',
  'DEEP_REVIEW',
  ...(AI_FOLLOWUP_PAID ? [] : (['AI_FOLLOWUP'] as EntitlementFeature[])),
  ...(CLIP_REVIEW_PAID ? [] : (['CLIP_REVIEW'] as EntitlementFeature[])),
];

function isExpired(nowIso: string, expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= new Date(nowIso).getTime();
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function plusDays(nowIso: string, days: number): string {
  const base = new Date(nowIso);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function firstFeature(plan: SubscriptionPlan): EntitlementFeature {
  const feature = plan.featureCodes[0];
  if (!feature) throw new Error(`Plan ${plan.planCode} has no feature code`);
  return feature;
}

function normalizeMapEntries<T>(input: unknown): Array<[string, T[]]> {
  if (Array.isArray(input)) {
    return input.filter((entry): entry is [string, T[]] => {
      return Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && Array.isArray(entry[1]);
    });
  }
  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? (v as T[]) : []]);
  }
  return [];
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === 'string');
}

const PLAN_SEED: SubscriptionPlan[] = [
  {
    id: 'plan-pro-monthly',
    planCode: 'PRO_MONTHLY',
    planType: 'MEMBERSHIP',
    planName: 'Pro 月卡',
    description: '解锁深度复盘、AI追问、视频片段诊断（30天）',
    status: 'ACTIVE',
    priceCents: 3900,
    currency: 'CNY',
    durationDays: 30,
    featureCodes: ['DEEP_REVIEW', 'AI_FOLLOWUP', 'CLIP_REVIEW'],
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
  {
    id: 'plan-deep-single',
    planCode: 'DEEP_SINGLE',
    planType: 'ONE_TIME',
    planName: '深度复盘单次解锁',
    description: '解锁 1 次深度复盘',
    status: 'ACTIVE',
    priceCents: 1200,
    currency: 'CNY',
    durationDays: 7,
    featureCodes: ['DEEP_REVIEW'],
    quotaPolicy: {
      featureCode: 'DEEP_REVIEW',
      units: 1,
      periodType: 'ORDER',
    },
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
  {
    id: 'plan-followup-pack5',
    planCode: 'FOLLOWUP_PACK_5',
    planType: 'QUOTA_PACK',
    planName: 'AI追问 5 次包',
    description: '补充 5 次 AI 追问额度',
    status: 'ACTIVE',
    priceCents: 1500,
    currency: 'CNY',
    durationDays: 30,
    featureCodes: ['AI_FOLLOWUP'],
    quotaPolicy: {
      featureCode: 'AI_FOLLOWUP',
      units: 5,
      periodType: 'ORDER',
    },
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
  {
    id: 'plan-clip-pack3',
    planCode: 'CLIP_PACK_3',
    planType: 'QUOTA_PACK',
    planName: '视频诊断 3 次包',
    description: '补充 3 次视频片段细节诊断额度',
    status: 'ACTIVE',
    priceCents: 1800,
    currency: 'CNY',
    durationDays: 30,
    featureCodes: ['CLIP_REVIEW'],
    quotaPolicy: {
      featureCode: 'CLIP_REVIEW',
      units: 3,
      periodType: 'ORDER',
    },
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
];

const FEATURE_GATES: FeatureGate[] = [
  {
    featureCode: 'BASIC_REVIEW',
    title: '基础单局复盘',
    description: '对最近对局输出固定结构的基础总结',
    isFree: true,
    recommendedPlanCodes: [],
  },
  {
    featureCode: 'BASIC_GROWTH_SUMMARY',
    title: '基础成长摘要',
    description: '聚合近期表现趋势和成长方向',
    isFree: true,
    recommendedPlanCodes: [],
  },
  {
    featureCode: 'DEEP_REVIEW',
    title: '深度复盘',
    description: '多维度拆解失误、节奏和决策质量',
    isFree: true,
    recommendedPlanCodes: [],
  },
  {
    featureCode: 'AI_FOLLOWUP',
    title: 'AI追问',
    description: '围绕报告继续发问，获得可执行建议',
    isFree: !AI_FOLLOWUP_PAID,
    recommendedPlanCodes: ['PRO_MONTHLY', 'FOLLOWUP_PACK_5'],
  },
  {
    featureCode: 'CLIP_REVIEW',
    title: '视频片段细节诊断',
    description: '针对关键片段进行逐镜头决策诊断',
    isFree: !CLIP_REVIEW_PAID,
    recommendedPlanCodes: ['PRO_MONTHLY', 'CLIP_PACK_3'],
  },
];

export class MockBillingRepository {
  private readonly plans = PLAN_SEED.map((item) => ({ ...item }));
  private readonly featureGates = FEATURE_GATES.map((item) => ({ ...item }));
  private readonly userEntitlements = new Map<string, UserEntitlement[]>();
  private readonly quotas = new Map<string, UsageQuota[]>();
  private readonly orders = new Map<string, PurchaseOrder[]>();
  private readonly payments = new Map<string, PaymentRecord[]>();
  private readonly unlocks = new Map<string, UnlockRecord[]>();
  private readonly usageLedger = new Set<string>();
  private readonly store: PersistentStateStore;

  constructor(store: PersistentStateStore = createPersistentStateStore('billing-repository')) {
    this.store = store;
    this.hydrate();
  }

  listFeatureGates(): FeatureGate[] {
    return this.featureGates.map((item) => ({ ...item }));
  }

  listPlans(featureCode?: EntitlementFeature): SubscriptionPlan[] {
    const active = this.plans.filter((item) => item.status === 'ACTIVE');
    if (!featureCode) return active.map((item) => ({ ...item }));
    return active.filter((item) => item.featureCodes.includes(featureCode)).map((item) => ({ ...item }));
  }

  getEntitlementState(userId: string, nowIso: string): EntitlementState {
    const features: Record<EntitlementFeature, boolean> = {
      BASIC_REVIEW: true,
      BASIC_GROWTH_SUMMARY: true,
      DEEP_REVIEW: true,
      AI_FOLLOWUP: !AI_FOLLOWUP_PAID,
      CLIP_REVIEW: !CLIP_REVIEW_PAID,
    };
    const remainingQuota: Partial<Record<EntitlementFeature, number>> = {};

    for (const feature of Object.keys(features) as EntitlementFeature[]) {
      const decision = this.checkAccess(userId, feature, nowIso);
      features[feature] = decision.can_access;
      if (typeof decision.remaining_quota === 'number') {
        remainingQuota[feature] = decision.remaining_quota;
      }
    }

    return {
      userId,
      features,
      remainingQuota,
      effectiveEntitlements: this.activeEntitlements(userId, nowIso),
      featureGates: this.listFeatureGates(),
    };
  }

  checkAccess(userId: string, featureCode: EntitlementFeature, nowIso: string): EntitlementDecision {
    const gate = this.featureGates.find((item) => item.featureCode === featureCode);
    if (!gate) {
      return {
        can_access: false,
        reason_code: 'INVALID_REQUEST',
        display_message: '未知能力',
      };
    }

    if (gate.isFree || FREE_FEATURES.includes(featureCode)) {
      return {
        can_access: true,
        reason_code: 'FEATURE_FREE',
        display_message: `${gate.title}为免费能力`,
      };
    }

    const activeEntitlement = this.activeEntitlements(userId, nowIso).find((item) => item.featureCode === featureCode);
    const remaining = this.remainingQuota(userId, featureCode, nowIso);
    if (activeEntitlement) {
      if (remaining === undefined) {
        return {
          can_access: true,
          reason_code:
            activeEntitlement.sourceType === 'SUBSCRIPTION'
              ? 'ENTITLED_BY_MEMBERSHIP'
              : activeEntitlement.sourceType === 'UNLOCK'
                ? 'ENTITLED_BY_UNLOCK'
                : 'ENTITLED_BY_PURCHASE',
          display_message: `${gate.title}已解锁`,
        };
      }
      if (remaining > 0) {
        return {
          can_access: true,
          reason_code: 'QUOTA_AVAILABLE',
          display_message: `${gate.title}可用，剩余${remaining}次`,
          remaining_quota: remaining,
        };
      }
      return {
        can_access: false,
        reason_code: 'QUOTA_EXHAUSTED',
        display_message: `${gate.title}额度已用尽`,
        remaining_quota: 0,
        paywall_payload: this.buildPaywallPayload(featureCode, gate),
      };
    }

    const openOrder = (this.orders.get(userId) ?? []).some((item) => item.featureCode === featureCode && item.status === 'PENDING_PAYMENT');
    if (openOrder) {
      return {
        can_access: false,
        reason_code: 'PAYMENT_PENDING',
        display_message: '订单待支付确认',
        paywall_payload: this.buildPaywallPayload(featureCode, gate),
      };
    }

    return {
      can_access: false,
      reason_code: 'NO_ACTIVE_ENTITLEMENT',
      display_message: `${gate.title}需要解锁后使用`,
      paywall_payload: this.buildPaywallPayload(featureCode, gate),
    };
  }

  explain(userId: string, featureCode: EntitlementFeature, nowIso: string) {
    const decision = this.checkAccess(userId, featureCode, nowIso);
    return {
      userId,
      featureCode,
      decision,
      activeEntitlements: this.activeEntitlements(userId, nowIso).filter((item) => item.featureCode === featureCode),
      activeQuotas: this.activeQuotas(userId, featureCode, nowIso),
      availablePlans: this.listPlans(featureCode),
    };
  }

  consumeUsage(input: ConsumeUsageInput): ConsumeUsageResult {
    const { userId, featureCode, usageKey, operationStatus, nowIso } = input;
    const decision = this.checkAccess(userId, featureCode, nowIso);
    if (!decision.can_access) {
      return {
        consumed: false,
        reason_code: decision.reason_code,
        display_message: decision.display_message,
        remaining_quota: decision.remaining_quota,
      };
    }

    if (operationStatus === 'FAILED') {
      return {
        consumed: false,
        reason_code: 'INVALID_REQUEST',
        display_message: '任务失败，额度不扣减',
        remaining_quota: decision.remaining_quota,
      };
    }

    const ledgerKey = `${userId}:${featureCode}:${usageKey}`;
    if (this.usageLedger.has(ledgerKey)) {
      return {
        consumed: false,
        reason_code: 'INVALID_REQUEST',
        display_message: '重复扣减请求已忽略',
        remaining_quota: this.remainingQuota(userId, featureCode, nowIso),
      };
    }

    const quotaList = this.activeQuotas(userId, featureCode, nowIso);
    if (!quotaList.length) {
      this.usageLedger.add(ledgerKey);
      this.persist();
      return {
        consumed: true,
        reason_code: 'FEATURE_FREE',
        display_message: '无需扣减额度',
      };
    }

    const target = quotaList[0];
    if (!target || target.usedUnits >= target.totalUnits) {
      return {
        consumed: false,
        reason_code: 'QUOTA_EXHAUSTED',
        display_message: '额度不足，扣减失败',
        remaining_quota: 0,
      };
    }

    target.usedUnits += 1;
    target.updatedAt = nowIso;
    target.status = target.usedUnits >= target.totalUnits ? 'EXHAUSTED' : 'ACTIVE';
    this.usageLedger.add(ledgerKey);
    this.persist();

    return {
      consumed: true,
      reason_code: 'QUOTA_AVAILABLE',
      display_message: '额度扣减成功',
      remaining_quota: target.totalUnits - target.usedUnits,
    };
  }

  createOrder(input: CreateOrderInput) {
    const plan = this.plans.find((item) => item.planCode === input.planCode && item.status === 'ACTIVE');
    if (!plan) {
      return { ok: false as const, reason: 'Plan not found' };
    }

    if (input.featureCode && !plan.featureCodes.includes(input.featureCode)) {
      return { ok: false as const, reason: 'Plan does not support requested feature' };
    }

    const order: PurchaseOrder = {
      id: randomId('ord'),
      userId: input.userId,
      planId: plan.id,
      featureCode: input.featureCode ?? plan.featureCodes[0],
      status: 'PENDING_PAYMENT',
      amountCents: plan.priceCents,
      currency: plan.currency,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
    this.orders.set(input.userId, [...(this.orders.get(input.userId) ?? []), order]);

    const payment: PaymentRecord = {
      id: randomId('pay'),
      orderId: order.id,
      userId: input.userId,
      provider: 'MOCK_PAY',
      transactionId: `txn-pending-${order.id}`,
      status: 'INITIATED',
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
    this.payments.set(input.userId, [...(this.payments.get(input.userId) ?? []), payment]);
    this.persist();

    return {
      ok: true as const,
      order,
      payment,
      paywall_payload: this.buildPaywallPayload(order.featureCode ?? firstFeature(plan), this.getFeatureGate(order.featureCode)),
    };
  }

  confirmPayment(input: ConfirmPaymentInput) {
    const orderEntry = this.findOrder(input.orderId);
    if (!orderEntry) {
      return { ok: false as const, reason: 'Order not found' };
    }
    const { userId, order } = orderEntry;
    if (order.status !== 'PENDING_PAYMENT') {
      return { ok: false as const, reason: `Order cannot be confirmed from ${order.status}` };
    }

    order.status = 'PAID';
    order.paidAt = input.nowIso;
    order.updatedAt = input.nowIso;

    const paymentList = this.payments.get(userId) ?? [];
    const payment = paymentList.find((item) => item.orderId === order.id && item.status === 'INITIATED');
    if (!payment) return { ok: false as const, reason: 'Payment record not found' };
    payment.status = 'SUCCEEDED';
    payment.transactionId = input.transactionId;
    payment.paidAt = input.nowIso;
    payment.updatedAt = input.nowIso;

    const plan = this.plans.find((item) => item.id === order.planId);
    if (!plan) return { ok: false as const, reason: 'Plan missing for order' };

    this.fulfillOrder(userId, order, plan, input.nowIso);
    this.persist();
    return {
      ok: true as const,
      order,
      payment,
      state: this.getEntitlementState(userId, input.nowIso),
    };
  }

  snapshot(userId: string, nowIso: string): EntitlementRepositorySnapshot {
    return {
      userId,
      gates: this.listFeatureGates(),
      plans: this.listPlans(),
      entitlements: this.activeEntitlements(userId, nowIso),
      quotas: this.activeQuotas(userId, undefined, nowIso),
      orders: [...(this.orders.get(userId) ?? [])],
      payments: [...(this.payments.get(userId) ?? [])],
      unlocks: [...(this.unlocks.get(userId) ?? [])],
    };
  }

  private findOrder(orderId: string): { userId: string; order: PurchaseOrder } | undefined {
    for (const [userId, orders] of this.orders.entries()) {
      const order = orders.find((item) => item.id === orderId);
      if (order) return { userId, order };
    }
    return undefined;
  }

  private buildPaywallPayload(featureCode: EntitlementFeature, gate?: FeatureGate): PaywallPayload {
    const gateResolved = gate ?? this.getFeatureGate(featureCode);
    const plans = this.listPlans(featureCode).map((item) => ({
      planId: item.id,
      planCode: item.planCode,
      planName: item.planName,
      planType: item.planType,
      priceCents: item.priceCents,
      currency: item.currency,
      description: item.description,
    }));

    return {
      featureCode,
      title: gateResolved.title,
      message: `${gateResolved.title}是收费能力，请先解锁`,
      plans,
    };
  }

  private getFeatureGate(featureCode?: EntitlementFeature): FeatureGate {
    const fallback = this.featureGates[0];
    if (!fallback) {
      throw new Error('Feature gates are not initialized');
    }
    const gate = featureCode ? this.featureGates.find((item) => item.featureCode === featureCode) : fallback;
    return gate ?? fallback;
  }

  private activeEntitlements(userId: string, nowIso: string): UserEntitlement[] {
    const records = this.userEntitlements.get(userId) ?? [];
    const updated = records.map((item) => {
      if (item.status === 'ACTIVE' && isExpired(nowIso, item.expiresAt)) {
        return {
          ...item,
          status: 'EXPIRED' as const,
          updatedAt: nowIso,
        };
      }
      return item;
    });
    this.userEntitlements.set(userId, updated);
    this.persist();
    return updated.filter((item) => item.status === 'ACTIVE').map((item) => ({ ...item }));
  }

  private activeQuotas(userId: string, featureCode: EntitlementFeature | undefined, nowIso: string): UsageQuota[] {
    const records = this.quotas.get(userId) ?? [];
    const updated = records.map((item) => {
      if (item.status === 'ACTIVE' && isExpired(nowIso, item.expiresAt)) {
        return {
          ...item,
          status: 'EXPIRED' as const,
          updatedAt: nowIso,
        };
      }
      if (item.status === 'ACTIVE' && item.usedUnits >= item.totalUnits) {
        return {
          ...item,
          status: 'EXHAUSTED' as const,
          updatedAt: nowIso,
        };
      }
      return item;
    });
    this.quotas.set(userId, updated);
    this.persist();
    return updated
      .filter((item) => item.status === 'ACTIVE')
      .filter((item) => (featureCode ? item.featureCode === featureCode : true));
  }

  private remainingQuota(userId: string, featureCode: EntitlementFeature, nowIso: string): number | undefined {
    const records = this.quotas.get(userId) ?? [];
    const related = records.filter((item) => item.featureCode === featureCode && !isExpired(nowIso, item.expiresAt));
    if (!related.length) return undefined;
    return related.reduce((sum, item) => sum + Math.max(item.totalUnits - item.usedUnits, 0), 0);
  }

  private fulfillOrder(userId: string, order: PurchaseOrder, plan: SubscriptionPlan, nowIso: string): void {
    order.status = 'FULFILLED';
    order.fulfilledAt = nowIso;
    order.updatedAt = nowIso;

    const entitlements = this.userEntitlements.get(userId) ?? [];
    const quotas = this.quotas.get(userId) ?? [];
    const unlocks = this.unlocks.get(userId) ?? [];

    const expiresAt = plan.durationDays ? plusDays(nowIso, plan.durationDays) : undefined;
    for (const featureCode of plan.featureCodes) {
      const entitlement: UserEntitlement = {
        id: randomId('ent'),
        userId,
        featureCode,
        sourceType: plan.planType === 'MEMBERSHIP' ? 'SUBSCRIPTION' : plan.planType === 'ONE_TIME' ? 'UNLOCK' : 'PURCHASE',
        sourceRefId: order.id,
        status: 'ACTIVE',
        effectiveAt: nowIso,
        expiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      entitlements.push(entitlement);
    }

    if (plan.planType === 'ONE_TIME') {
      const unlock: UnlockRecord = {
        id: randomId('unlock'),
        userId,
        featureCode: firstFeature(plan),
        status: 'CONFIRMED',
        sourceOrderId: order.id,
        confirmedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      unlocks.push(unlock);
    }

    if (plan.quotaPolicy) {
      const quota: UsageQuota = {
        id: randomId('quota'),
        userId,
        featureCode: plan.quotaPolicy.featureCode,
        periodType: plan.quotaPolicy.periodType,
        totalUnits: plan.quotaPolicy.units,
        usedUnits: 0,
        status: 'ACTIVE',
        effectiveAt: nowIso,
        expiresAt,
        sourceRefId: order.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      quotas.push(quota);
    }

    this.userEntitlements.set(userId, entitlements);
    this.quotas.set(userId, quotas);
    this.unlocks.set(userId, unlocks);
    this.persist();
  }

  private hydrate(): void {
    const state = this.store.read<{
      userEntitlements?: unknown;
      quotas?: unknown;
      orders?: unknown;
      payments?: unknown;
      unlocks?: unknown;
      usageLedger?: unknown;
    }>('state');
    if (!state) return;
    this.userEntitlements.clear();
    this.quotas.clear();
    this.orders.clear();
    this.payments.clear();
    this.unlocks.clear();
    this.usageLedger.clear();
    for (const [k, v] of normalizeMapEntries<UserEntitlement>(state.userEntitlements)) this.userEntitlements.set(k, v);
    for (const [k, v] of normalizeMapEntries<UsageQuota>(state.quotas)) this.quotas.set(k, v);
    for (const [k, v] of normalizeMapEntries<PurchaseOrder>(state.orders)) this.orders.set(k, v);
    for (const [k, v] of normalizeMapEntries<PaymentRecord>(state.payments)) this.payments.set(k, v);
    for (const [k, v] of normalizeMapEntries<UnlockRecord>(state.unlocks)) this.unlocks.set(k, v);
    for (const key of normalizeStringArray(state.usageLedger)) this.usageLedger.add(key);
  }

  private persist(): void {
    this.store.write('state', {
      userEntitlements: [...this.userEntitlements.entries()],
      quotas: [...this.quotas.entries()],
      orders: [...this.orders.entries()],
      payments: [...this.payments.entries()],
      unlocks: [...this.unlocks.entries()],
      usageLedger: [...this.usageLedger.values()],
    });
  }
}
