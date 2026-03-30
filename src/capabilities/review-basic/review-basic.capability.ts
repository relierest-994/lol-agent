import type { Capability } from '../protocol';
import { BasicReviewEngine } from '../../infrastructure/providers/basic-review.engine';

const engine = new BasicReviewEngine();

export const basicReviewCapability: Capability<'review.basic'> = {
  name: 'review.basic',
  async execute(context, payload) {
    try {
      const report = engine.generate(payload.match, context.nowIso);
      return {
        ok: true,
        summary: '基础复盘已生成',
        data: { report },
      };
    } catch (error) {
      return {
        ok: false,
        summary: '基础复盘生成失败',
        error: error instanceof Error ? error.message : 'Unknown review error',
      };
    }
  },
};
