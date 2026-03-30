import type { Capability } from '../protocol';

export const deepReviewCapability: Capability<'review.deep'> = {
  name: 'review.deep',
  async execute() {
    return {
      ok: true,
      summary: '深度复盘能力已占位（需 entitlement）',
      data: { locked: true, reason: '深度复盘为付费能力，第一阶段仅开放占位' },
    };
  },
};
