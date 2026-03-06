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

  const prodEnv = () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_PRIVATE_KEY = 'my-private-key';
    process.env.JWT_PUBLIC_KEY = 'my-public-key';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:6543/db?pgbouncer=true';
    process.env.DIRECT_URL = 'postgresql://user:pass@host:5432/db';
    process.env.RESEND_API_KEY = 're_test_123456';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  };

  it('populates JWT_PRIVATE_KEY and JWT_PUBLIC_KEY when both are present', async () => {
    prodEnv();

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.JWT_PRIVATE_KEY).toBe('my-private-key');
    expect(ENV.JWT_PUBLIC_KEY).toBe('my-public-key');
  });

  it('populates DATABASE_URL and DIRECT_URL when both are present', async () => {
    prodEnv();

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.DATABASE_URL).toBe('postgresql://user:pass@host:6543/db?pgbouncer=true');
    expect(ENV.DIRECT_URL).toBe('postgresql://user:pass@host:5432/db');
  });

  it('throws when JWT_PRIVATE_KEY is missing in non-test env', async () => {
    prodEnv();
    delete process.env.JWT_PRIVATE_KEY;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: JWT_PRIVATE_KEY',
    );
  });

  it('throws when JWT_PUBLIC_KEY is missing in non-test env', async () => {
    prodEnv();
    delete process.env.JWT_PUBLIC_KEY;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: JWT_PUBLIC_KEY',
    );
  });

  it('throws when DATABASE_URL is missing in non-test env', async () => {
    prodEnv();
    delete process.env.DATABASE_URL;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('throws when DIRECT_URL is missing in non-test env', async () => {
    prodEnv();
    delete process.env.DIRECT_URL;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: DIRECT_URL',
    );
  });

  it('populates RESEND_API_KEY and RESEND_FROM_EMAIL when both are present', async () => {
    prodEnv();

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.RESEND_API_KEY).toBe('re_test_123456');
    expect(ENV.RESEND_FROM_EMAIL).toBe('no-reply@example.com');
  });

  it('throws when RESEND_API_KEY is missing in non-test env', async () => {
    prodEnv();
    delete process.env.RESEND_API_KEY;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: RESEND_API_KEY',
    );
  });

  it('throws when RESEND_FROM_EMAIL is missing in non-test env', async () => {
    prodEnv();
    delete process.env.RESEND_FROM_EMAIL;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: RESEND_FROM_EMAIL',
    );
  });

  it('throws when RESEND_FROM_EMAIL is not a valid email in non-test env', async () => {
    prodEnv();
    process.env.RESEND_FROM_EMAIL = 'not-an-email';

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: RESEND_FROM_EMAIL',
    );
  });

  it('skips validation and defaults to empty string when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.FRONTEND_URL;

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.JWT_PRIVATE_KEY).toBe('');
    expect(ENV.JWT_PUBLIC_KEY).toBe('');
    expect(ENV.DATABASE_URL).toBe('');
    expect(ENV.DIRECT_URL).toBe('');
    expect(ENV.RESEND_API_KEY).toBe('');
    expect(ENV.RESEND_FROM_EMAIL).toBe('');
    expect(ENV.FRONTEND_URL).toBe('');
  });

  it('throws when FRONTEND_URL is missing in non-test env', async () => {
    prodEnv();
    delete process.env.FRONTEND_URL;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: FRONTEND_URL',
    );
  });

  it('throws when FRONTEND_URL is not a valid URL in non-test env', async () => {
    prodEnv();
    process.env.FRONTEND_URL = 'not-a-url';

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: FRONTEND_URL',
    );
  });
});
