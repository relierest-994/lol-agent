import { loadRuntimeConfig, type RuntimeMode } from '../../infrastructure/config/runtime-config';
import { capabilityDefinitions } from './definitions';
import { MockCapabilityProvider } from './providers/mock-capability.provider';
import { createRealCapabilityProvider } from './providers/real-capability.provider';
import { CapabilityRegistry } from './registry';

function hydrateRegistry(registry: CapabilityRegistry): CapabilityRegistry {
  for (const definition of capabilityDefinitions) {
    registry.register(definition);
  }
  return registry;
}

export function createMockCapabilityRegistry(): CapabilityRegistry {
  const provider = new MockCapabilityProvider();
  return hydrateRegistry(new CapabilityRegistry(provider));
}

export function createRealCapabilityRegistry(): CapabilityRegistry {
  const provider = createRealCapabilityProvider();
  return hydrateRegistry(new CapabilityRegistry(provider));
}

export function createCapabilityRegistry(mode?: RuntimeMode): CapabilityRegistry {
  const runtimeMode = mode ?? loadRuntimeConfig().providerMode;
  return runtimeMode === 'mock' ? createMockCapabilityRegistry() : createRealCapabilityRegistry();
}

export * from './types';
export * from './errors';
export * from './registry';
export * from './definitions';
