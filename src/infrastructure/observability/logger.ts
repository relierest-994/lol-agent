export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  traceId?: string;
  correlationId?: string;
  component?: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const maskedContext = context ? maskSensitiveContext(context) : undefined;
  const payload = {
    at: new Date().toISOString(),
    level,
    message,
    ...maskedContext,
  };

  if (level === 'ERROR') {
    console.error(payload);
    return;
  }
  if (level === 'WARN') {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

function maskSensitiveValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 6) return '***';
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return '***';
}

function isSensitiveKey(key: string): boolean {
  return /(key|secret|token|password|authorization|signature)/i.test(key);
}

function maskSensitiveContext(context: LogContext): LogContext {
  const masked: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveKey(key)) {
      masked[key] = maskSensitiveValue(value);
      continue;
    }
    masked[key] = value;
  }
  return masked;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    write('DEBUG', message, context);
  },
  info(message: string, context?: LogContext) {
    write('INFO', message, context);
  },
  warn(message: string, context?: LogContext) {
    write('WARN', message, context);
  },
  error(message: string, context?: LogContext) {
    write('ERROR', message, context);
  },
};
