import type { EntitlementDecision, EntitlementFeature } from '../../domain';
import { MockBillingRepository } from '../../infrastructure/repositories/mock-billing.repository';

export interface EntitlementCheckRequest {
  userId: string;
  featureCode: EntitlementFeature;
  nowIso: string;
}

export interface UsageConsumeRequest {
  userId: string;
  featureCode: EntitlementFeature;
  usageKey: string;
  operationStatus: 'SUCCESS' | 'FAILED';
  nowIso: string;
}

export interface UnlockCreateRequest {
  userId: string;
  planCode: string;
  featureCode?: EntitlementFeature;
  nowIso: string;
}

export interface UnlockConfirmRequest {
  orderId: string;
  transactionId: string;
  nowIso: string;
}

export class EntitlementBillingService {
  constructor(private readonly repository: MockBillingRepository) {}

  getEntitlementState(userId: string, nowIso: string) {
    return this.repository.getEntitlementState(userId, nowIso);
  }

  check(request: EntitlementCheckRequest): EntitlementDecision {
    return this.repository.checkAccess(request.userId, request.featureCode, request.nowIso);
  }

  explain(request: EntitlementCheckRequest) {
    return this.repository.explain(request.userId, request.featureCode, request.nowIso);
  }

  consume(request: UsageConsumeRequest) {
    return this.repository.consumeUsage(request);
  }

  createUnlockOrder(request: UnlockCreateRequest) {
    return this.repository.createOrder({
      userId: request.userId,
      planCode: request.planCode,
      featureCode: request.featureCode,
      nowIso: request.nowIso,
    });
  }

  confirmUnlock(request: UnlockConfirmRequest) {
    return this.repository.confirmPayment({
      orderId: request.orderId,
      transactionId: request.transactionId,
      nowIso: request.nowIso,
    });
  }

  getSnapshot(userId: string, nowIso: string) {
    return this.repository.snapshot(userId, nowIso);
  }
}

const sharedRepository = new MockBillingRepository();
export const entitlementBillingService = new EntitlementBillingService(sharedRepository);
