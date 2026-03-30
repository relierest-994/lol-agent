import { entitlementBillingService } from '../../application/services/entitlement-billing.service';
import type { EntitlementState } from '../../domain';

export class MockEntitlementRepository {
  async get(userId: string): Promise<EntitlementState> {
    return entitlementBillingService.getEntitlementState(userId, new Date().toISOString());
  }
}
