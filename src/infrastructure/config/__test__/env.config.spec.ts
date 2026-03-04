import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('env.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('populates JWT_PRIVATE_KEY and JWT_PUBLIC_KEY when both are present', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_PRIVATE_KEY = 'my-private-key';
    process.env.JWT_PUBLIC_KEY = 'my-public-key';

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.JWT_PRIVATE_KEY).toBe('my-private-key');
    expect(ENV.JWT_PUBLIC_KEY).toBe('my-public-key');
  });

  it('throws when JWT_PRIVATE_KEY is missing in non-test env', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_PRIVATE_KEY;
    process.env.JWT_PUBLIC_KEY = 'my-public-key';

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: JWT_PRIVATE_KEY',
    );
  });

  it('throws when JWT_PUBLIC_KEY is missing in non-test env', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_PRIVATE_KEY = 'my-private-key';
    delete process.env.JWT_PUBLIC_KEY;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: JWT_PUBLIC_KEY',
    );
  });

  it('skips JWT validation and defaults to empty string when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.JWT_PRIVATE_KEY).toBe('');
    expect(ENV.JWT_PUBLIC_KEY).toBe('');
  });
});
