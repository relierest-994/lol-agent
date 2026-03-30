import { describe, expect, it } from 'vitest';
import { loadPg16Config, validatePg16Config } from '../src/infrastructure/config/pg16-config';

describe('PG16 config', () => {
  it('loads defaults and validates', () => {
    const config = loadPg16Config();
    const result = validatePg16Config(config);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid pool boundaries', () => {
    const config = loadPg16Config();
    const result = validatePg16Config({
      ...config,
      poolMin: 30,
      poolMax: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.includes('POOL_MIN'))).toBe(true);
  });
});

