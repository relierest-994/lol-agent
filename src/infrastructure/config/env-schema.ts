import type { RuntimeConfig } from './runtime-config';

export interface EnvSchemaValidation {
  valid: boolean;
  errors: string[];
}

export function validateRuntimeEnvSchema(config: RuntimeConfig): EnvSchemaValidation {
  const errors: string[] = [];
  const env = config.appEnv;

  if (!config.queueName.trim()) errors.push('QUEUE_NAME is required');
  if (!config.storageBucket.trim()) errors.push('STORAGE_BUCKET is required');

  if (env === 'staging' || env === 'prod') {
    if (!config.llmApiKey) errors.push('LLM_API_KEY is required for staging/prod');
    if (!config.paymentApiKey) errors.push('PAYMENT_API_KEY is required for staging/prod');
    if (!config.videoApiKey) errors.push('VIDEO_API_KEY is required for staging/prod');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
