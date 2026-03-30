import type { RuntimeConfig } from './runtime-config';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function validateProviderConfig(config: RuntimeConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!['dev', 'staging', 'prod'].includes(config.appEnv)) {
    warnings.push(`appEnv "${config.appEnv}" is not one of dev/staging/prod`);
  }

  if (!isHttpUrl(config.apiBaseUrl)) errors.push('apiBaseUrl must be an http(s) URL');
  if (!isHttpUrl(config.videoApiUrl)) errors.push('videoApiUrl must be an http(s) URL');
  if (!isHttpUrl(config.storageApiUrl)) errors.push('storageApiUrl must be an http(s) URL');
  if (!isHttpUrl(config.queueApiUrl)) errors.push('queueApiUrl must be an http(s) URL');
  if (!isHttpUrl(config.paymentApiUrl)) errors.push('paymentApiUrl must be an http(s) URL');
  if (!['http', 'local'].includes(config.queueRuntimeMode)) errors.push('queueRuntimeMode must be http or local');

  if (config.llmEnabled) {
    if (!isHttpUrl(config.llmApiUrl)) errors.push('llmApiUrl must be an http(s) URL when LLM is enabled');
    if (!config.llmModel.trim()) errors.push('llmModel is required when LLM is enabled');
    if (!config.llmApiKey) warnings.push('llmApiKey is empty, LLM calls will fallback or fail');
  }

  if (!config.videoApiKey) warnings.push('videoApiKey is empty, multimodal provider may reject requests');
  if (!config.videoLlmModel.trim()) errors.push('videoLlmModel is required');
  if (!config.paymentApiKey) warnings.push('paymentApiKey is empty, payment provider may reject requests');
  if (!config.paymentWebhookSecret) warnings.push('paymentWebhookSecret is empty, callback verification may fail');
  if (!config.storageBucket.trim()) errors.push('storageBucket is required');
  if (!config.queueName.trim()) errors.push('queueName is required');
  if (config.requestTimeoutMs < 1000) warnings.push('requestTimeoutMs is unusually low');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
