import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry, createMockCapabilityRegistry, createRealCapabilityRegistry } from '../src/capabilities/toolkit';

describe('Phase3 Provider Switching', () => {
  it('keeps explicit mock registry available', () => {
    const registry = createMockCapabilityRegistry();
    expect(registry.list().length).toBeGreaterThan(0);
  });

  it('supports real registry factory', () => {
    const registry = createRealCapabilityRegistry();
    expect(registry.list().length).toBeGreaterThan(0);
  });

  it('uses generic registry factory with mode input', () => {
    const real = createCapabilityRegistry('real');
    const mock = createCapabilityRegistry('mock');
    expect(real.list().length).toBe(mock.list().length);
  });
});
