export type ProviderErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  details?: string;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function mapProviderError(error: unknown): NormalizedProviderError {
  const message = asMessage(error).toLowerCase();

  if (message.includes('aborted') || message.includes('timeout')) {
    return {
      code: 'TIMEOUT',
      message: 'Provider request timed out',
      retryable: true,
      details: asMessage(error),
    };
  }
  if (message.includes('429') || message.includes('rate')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Provider rate limit reached',
      retryable: true,
      details: asMessage(error),
    };
  }
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return {
      code: 'UNAUTHORIZED',
      message: 'Provider credentials rejected',
      retryable: false,
      details: asMessage(error),
    };
  }
  if (message.includes('400') || message.includes('invalid input') || message.includes('bad request')) {
    return {
      code: 'BAD_REQUEST',
      message: 'Provider rejected request payload',
      retryable: false,
      details: asMessage(error),
    };
  }
  if (message.includes('502') || message.includes('503') || message.includes('504') || message.includes('fetch failed')) {
    return {
      code: 'UNAVAILABLE',
      message: 'Provider temporarily unavailable',
      retryable: true,
      details: asMessage(error),
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Provider request failed',
    retryable: true,
    details: asMessage(error),
  };
}
