import type { Capability } from '../protocol';
import { MockEntitlementRepository } from '../../infrastructure/repositories/mock-entitlement.repository';

const repository = new MockEntitlementRepository();

export const billingGateCapability: Capability<'billing.guard'> = {
  name: 'billing.guard',
  async execute(context, payload) {
    try {
      const entitlement = await repository.get(context.userId);
      const allowed = entitlement.features[payload.feature];
      if (!allowed) {
        return {
          ok: true,
          summary: `${payload.feature} 未解锁`,
          data: { allowed: false, reason: '需要订阅后解锁该能力' },
        };
      }
      return {
        ok: true,
        summary: `${payload.feature} 已解锁`,
        data: { allowed: true },
      };
    } catch (error) {
      return {
        ok: false,
        summary: '权限校验失败',
        error: error instanceof Error ? error.message : 'Unknown billing gate error',
      };
    }
  },
};
