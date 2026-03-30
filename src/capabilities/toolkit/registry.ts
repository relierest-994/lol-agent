import { invalidInput } from './errors';
import type {
  CapabilityDefinition,
  CapabilityId,
  CapabilityInvocationRequest,
  CapabilityInvocationResponse,
  CapabilityMeta,
  CapabilityProvider,
  CapabilityResult,
  CapabilitySchema,
} from './types';

type UnknownCapability = CapabilityDefinition<any, any>;

function validateInput(schema: CapabilitySchema, input: unknown): CapabilityResult<true> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return invalidInput('Input must be an object');
  }

  const payload = input as Record<string, unknown>;
  for (const key of schema.required) {
    if (!(key in payload)) {
      return invalidInput(`Missing required field: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    const field = schema.properties[key];
    if (!field || value === undefined) continue;

    if (field.type === 'array' && !Array.isArray(value)) {
      return invalidInput(`Field ${key} must be array`);
    }
    if (field.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      return invalidInput(`Field ${key} must be object`);
    }
    if (field.type === 'string' && typeof value !== 'string') {
      return invalidInput(`Field ${key} must be string`);
    }
    if (field.type === 'number' && typeof value !== 'number') {
      return invalidInput(`Field ${key} must be number`);
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      return invalidInput(`Field ${key} must be boolean`);
    }
    if (field.enum && typeof value === 'string' && !field.enum.includes(value)) {
      return invalidInput(`Field ${key} must be one of: ${field.enum.join(', ')}`);
    }
  }

  return { ok: true, data: true };
}

export class CapabilityRegistry {
  private readonly registry = new Map<CapabilityId, UnknownCapability>();

  constructor(private readonly provider: CapabilityProvider) {}

  register(definition: UnknownCapability): void {
    this.registry.set(definition.id, definition);
  }

  get(id: CapabilityId): UnknownCapability | undefined {
    return this.registry.get(id);
  }

  list(): CapabilityMeta[] {
    return Array.from(this.registry.values()).map((item) => ({
      id: item.id,
      title: item.title,
      inputSchema: item.inputSchema,
      outputSchema: item.outputSchema,
      errorSchema: item.errorSchema,
      entitlement: item.entitlement,
    }));
  }

  metadata(id: CapabilityId): CapabilityMeta | undefined {
    const capability = this.registry.get(id);
    if (!capability) return undefined;
    return {
      id: capability.id,
      title: capability.title,
      inputSchema: capability.inputSchema,
      outputSchema: capability.outputSchema,
      errorSchema: capability.errorSchema,
      entitlement: capability.entitlement,
    };
  }

  async invoke<TInput, TOutput>(
    request: CapabilityInvocationRequest<TInput>
  ): Promise<CapabilityInvocationResponse<TOutput>> {
    const capability = this.registry.get(request.id);
    if (!capability) {
      return {
        id: request.id,
        meta: {
          id: request.id,
          title: 'Unknown capability',
          inputSchema: { type: 'object', required: [], properties: {} },
          outputSchema: { type: 'object', required: [], properties: {} },
          errorSchema: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', description: 'Error code' },
              message: { type: 'string', description: 'Message' },
              details: { type: 'string', description: 'Details' },
              retryable: { type: 'boolean', description: 'Retryable' },
            },
          },
          entitlement: { required: false, description: 'Unknown capability' },
        },
        result: {
          ok: false,
          error: {
            code: 'CAPABILITY_NOT_REGISTERED',
            message: `Capability not registered: ${request.id}`,
            retryable: false,
          },
        },
      };
    }

    const validation = validateInput(capability.inputSchema, request.input);
    if (!validation.ok) {
      return {
        id: request.id,
        meta: this.metadata(request.id)!,
        result: validation,
      };
    }

    const result = await capability.invoke(
      request.context,
      request.input as Parameters<typeof capability.invoke>[1],
      this.provider
    );

    return {
      id: request.id,
      meta: this.metadata(request.id)!,
      result: result as CapabilityResult<TOutput>,
    };
  }
}
