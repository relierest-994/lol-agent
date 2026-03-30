import type { Capability } from '../protocol';

export const clipReviewCapability: Capability<'review.clip'> = {
  name: 'review.clip',
  async execute() {
    return {
      ok: true,
      summary: '视频片段细节诊断已占位（需 entitlement）',
      data: { locked: true, reason: '视频片段细节诊断为付费能力，第一阶段仅开放占位' },
    };
  },
};
