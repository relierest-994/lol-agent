import type { LinkedAccount, Region } from '../../../domain';
import { STANDARD_ERROR_SCHEMA, invalidInput, providerError } from '../errors';
import type { CapabilityDefinition, CapabilitySchema } from '../types';

const regionEnum: Region[] = ['INTERNATIONAL', 'CN'];

const accountInputSchema: CapabilitySchema = {
  type: 'object',
  required: ['userId', 'region'],
  properties: {
    userId: { type: 'string', description: 'User id' },
    region: { type: 'string', description: 'Selected region', enum: regionEnum },
    gameName: { type: 'string', description: 'Riot game name for international account linking' },
    tagLine: { type: 'string', description: 'Riot tag line for international account linking' },
  },
};

const accountOutputSchema: CapabilitySchema = {
  type: 'object',
  required: ['linked'],
  properties: {
    linked: { type: 'boolean', description: 'Whether account linked' },
    account: { type: 'object', description: 'Linked account object' },
  },
};

export interface AccountLinkStatusInput {
  userId: string;
  region: Region;
}

export interface AccountLinkStatusOutput {
  linked: boolean;
  account?: LinkedAccount;
}

export const accountLinkStatusCapability: CapabilityDefinition<
  AccountLinkStatusInput,
  AccountLinkStatusOutput
> = {
  id: 'account.link_status',
  title: 'Check account link status',
  inputSchema: accountInputSchema,
  outputSchema: accountOutputSchema,
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Free capability',
  },
  async invoke(_context, input, provider) {
    if (!input.userId || !input.region) return invalidInput('userId and region are required');

    try {
      const account = await provider.getLinkedAccount(input.userId, input.region);
      return {
        ok: true,
        data: {
          linked: Boolean(account),
          account,
        },
      };
    } catch (error) {
      return providerError('Failed to check account link status', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface AccountLinkMockInput {
  userId: string;
  region: Region;
  gameName?: string;
  tagLine?: string;
}

export interface AccountLinkMockOutput {
  account: LinkedAccount;
}

export const accountLinkMockCapability: CapabilityDefinition<AccountLinkMockInput, AccountLinkMockOutput> = {
  id: 'account.link_mock',
  title: 'Link account via mock provider',
  inputSchema: accountInputSchema,
  outputSchema: {
    type: 'object',
    required: ['account'],
    properties: {
      account: { type: 'object', description: 'Linked account object' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Free capability',
  },
  async invoke(_context, input, provider) {
    if (!input.userId || !input.region) return invalidInput('userId and region are required');

    try {
      const account = await provider.linkMockAccount(input.userId, input.region, {
        gameName: input.gameName,
        tagLine: input.tagLine,
      });
      return {
        ok: true,
        data: { account },
      };
    } catch (error) {
      return providerError('Failed to link mock account', error instanceof Error ? error.message : 'Unknown');
    }
  },
};

export interface RegionSelectInput {
  region: Region;
}

export interface RegionSelectOutput {
  region: Region;
  supported: boolean;
}

export const regionSelectCapability: CapabilityDefinition<RegionSelectInput, RegionSelectOutput> = {
  id: 'region.select',
  title: 'Select region context',
  inputSchema: {
    type: 'object',
    required: ['region'],
    properties: {
      region: { type: 'string', description: 'Selected region', enum: regionEnum },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['region', 'supported'],
    properties: {
      region: { type: 'string', description: 'Selected region' },
      supported: { type: 'boolean', description: 'Whether region is supported' },
    },
  },
  errorSchema: STANDARD_ERROR_SCHEMA,
  entitlement: {
    required: false,
    description: 'Free capability',
  },
  async invoke(_context, input) {
    if (!regionEnum.includes(input.region)) {
      return invalidInput('Unsupported region');
    }

    return {
      ok: true,
      data: {
        region: input.region,
        supported: true,
      },
    };
  },
};
