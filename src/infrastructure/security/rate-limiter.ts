import { createPersistentStateStore } from '../persistence/persistent-state.store';

interface BucketState {
  window_start: number;
  count: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  reset_after_ms: number;
}

export class RateLimiter {
  private readonly store = createPersistentStateStore('rate-limiter');

  consume(input: { key: string; limit: number; windowMs: number; now?: number }): RateLimitDecision {
    const now = input.now ?? Date.now();
    const stateKey = `bucket:${input.key}`;
    const current = this.store.read<BucketState>(stateKey);
    if (!current || now - current.window_start >= input.windowMs) {
      const fresh: BucketState = { window_start: now, count: 1 };
      this.store.write(stateKey, fresh);
      return {
        allowed: true,
        remaining: Math.max(0, input.limit - 1),
        reset_after_ms: input.windowMs,
      };
    }

    if (current.count >= input.limit) {
      return {
        allowed: false,
        remaining: 0,
        reset_after_ms: Math.max(0, input.windowMs - (now - current.window_start)),
      };
    }

    const updated: BucketState = {
      window_start: current.window_start,
      count: current.count + 1,
    };
    this.store.write(stateKey, updated);
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - updated.count),
      reset_after_ms: Math.max(0, input.windowMs - (now - updated.window_start)),
    };
  }
}

export const defaultRateLimiter = new RateLimiter();
