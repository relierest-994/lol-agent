import type { CapabilityErrorSchema } from './types';

export const STANDARD_ERROR_SCHEMA: CapabilityErrorSchema = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: { type: 'string', description: 'Stable error code for agent handling' },
    message: { type: 'string', description: 'Error summary for UI/agent trace' },
    details: { type: 'string', description: 'Optional debugging details' },
    retryable: { type: 'boolean', description: 'Whether retry makes sense' },
  },
};

export function invalidInput(message: string, details?: string) {
  return {
    ok: false as const,
    error: { code: 'INVALID_INPUT' as const, message, details, retryable: false },
  };
}

export function providerError(message: string, details?: string) {
  return {
    ok: false as const,
    error: { code: 'PROVIDER_ERROR' as const, message, details, retryable: true },
  };
}

export function entitlementRequired(message: string, details?: string) {
  return {
    ok: false as const,
    error: { code: 'ENTITLEMENT_REQUIRED' as const, message, details, retryable: false },
  };
}

export function notFound(message: string, details?: string) {
  return {
    ok: false as const,
    error: { code: 'NOT_FOUND' as const, message, details, retryable: false },
  };
}

export function unauthorized(message: string, details?: string) {
  return {
    ok: false as const,
    error: { code: 'UNAUTHORIZED' as const, message, details, retryable: false },
  };
}
