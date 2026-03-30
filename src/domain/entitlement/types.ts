export type EntitlementFeature =
  | 'BASIC_REVIEW'
  | 'BASIC_GROWTH_SUMMARY'
  | 'DEEP_REVIEW'
  | 'AI_FOLLOWUP'
  | 'CLIP_REVIEW';

export type PlanType = 'MEMBERSHIP' | 'ONE_TIME' | 'QUOTA_PACK';
export type PlanStatus = 'ACTIVE' | 'INACTIVE';

export type EntitlementStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type EntitlementSourceType = 'FREE' | 'SUBSCRIPTION' | 'PURCHASE' | 'UNLOCK';

export type QuotaPeriodType = 'LIFETIME' | 'MONTHLY' | 'DAILY' | 'ORDER';
export type QuotaStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type PaymentStatus = 'INITIATED' | 'SUCCEEDED' | 'FAILED';
export type UnlockStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type ReasonCode =
  | 'FEATURE_FREE'
  | 'ENTITLED_BY_MEMBERSHIP'
  | 'ENTITLED_BY_PURCHASE'
  | 'ENTITLED_BY_UNLOCK'
  | 'QUOTA_AVAILABLE'
  | 'QUOTA_EXHAUSTED'
  | 'FEATURE_LOCKED'
  | 'NO_ACTIVE_ENTITLEMENT'
  | 'PAYMENT_PENDING'
  | 'INVALID_REQUEST';

export interface SubscriptionPlan {
  id: string;
  planCode: string;
  planType: PlanType;
  planName: string;
  description: string;
  status: PlanStatus;
  priceCents: number;
  currency: 'CNY' | 'USD';
  durationDays?: number;
  featureCodes: EntitlementFeature[];
  quotaPolicy?: {
    featureCode: EntitlementFeature;
    units: number;
    periodType: QuotaPeriodType;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserEntitlement {
  id: string;
  userId: string;
  featureCode: EntitlementFeature;
  sourceType: EntitlementSourceType;
  sourceRefId: string;
  status: EntitlementStatus;
  effectiveAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageQuota {
  id: string;
  userId: string;
  featureCode: EntitlementFeature;
  periodType: QuotaPeriodType;
  totalUnits: number;
  usedUnits: number;
  status: QuotaStatus;
  effectiveAt: string;
  expiresAt?: string;
  resetAt?: string;
  sourceRefId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  userId: string;
  planId: string;
  featureCode?: EntitlementFeature;
  status: OrderStatus;
  amountCents: number;
  currency: 'CNY' | 'USD';
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  fulfilledAt?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  provider: 'MOCK_PAY' | 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY';
  transactionId: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export interface UnlockRecord {
  id: string;
  userId: string;
  featureCode: EntitlementFeature;
  status: UnlockStatus;
  sourceOrderId: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export interface FeatureGate {
  featureCode: EntitlementFeature;
  title: string;
  description: string;
  isFree: boolean;
  defaultQuota?: {
    units: number;
    periodType: QuotaPeriodType;
  };
  recommendedPlanCodes: string[];
}

export interface PaywallPlanOption {
  planId: string;
  planCode: string;
  planName: string;
  planType: PlanType;
  priceCents: number;
  currency: 'CNY' | 'USD';
  description: string;
}

export interface PaywallPayload {
  featureCode: EntitlementFeature;
  title: string;
  message: string;
  plans: PaywallPlanOption[];
}

export interface EntitlementDecision {
  can_access: boolean;
  reason_code: ReasonCode;
  display_message: string;
  paywall_payload?: PaywallPayload;
  remaining_quota?: number;
}

export interface EntitlementState {
  userId: string;
  features: Record<EntitlementFeature, boolean>;
  remainingQuota: Partial<Record<EntitlementFeature, number>>;
  effectiveEntitlements: UserEntitlement[];
  featureGates: FeatureGate[];
}
