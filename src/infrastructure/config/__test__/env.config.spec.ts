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
    process.env.DATABASE_URL =
      'postgresql://testuser:testpass@localhost:6543/testdb?pgbouncer=true';
    process.env.DIRECT_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
    process.env.RESEND_API_KEY = 'resend-placeholder-key-for-tests';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = 'my-google-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'my-google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
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

    expect(ENV.DATABASE_URL).toBe(
      'postgresql://testuser:testpass@localhost:6543/testdb?pgbouncer=true',
    );
    expect(ENV.DIRECT_URL).toBe('postgresql://testuser:testpass@localhost:5432/testdb');
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

    expect(ENV.RESEND_API_KEY).toBe('resend-placeholder-key-for-tests');
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
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.JWT_PRIVATE_KEY).toBe('');
    expect(ENV.JWT_PUBLIC_KEY).toBe('');
    expect(ENV.DATABASE_URL).toBe('');
    expect(ENV.DIRECT_URL).toBe('');
    expect(ENV.RESEND_API_KEY).toBe('');
    expect(ENV.RESEND_FROM_EMAIL).toBe('');
    expect(ENV.FRONTEND_URL).toBe('');
    expect(ENV.GOOGLE_CLIENT_ID).toBe('');
    expect(ENV.GOOGLE_CLIENT_SECRET).toBe('');
    expect(ENV.GOOGLE_CALLBACK_URL).toBe('');
    expect(ENV.VERIFICATION_TOKEN_TTL_MS).toBe(86_400_000);
    expect(ENV.RESET_TOKEN_TTL_MS).toBe(3_600_000);
    expect(ENV.RATE_LIMIT_WINDOW_MS).toBe(3_600_000);
    expect(ENV.RATE_LIMIT_MAX_ATTEMPTS).toBe(3);
  });

  it('uses default values for TTLs and rate limit when not set', async () => {
    prodEnv();

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.VERIFICATION_TOKEN_TTL_MS).toBe(86_400_000);
    expect(ENV.RESET_TOKEN_TTL_MS).toBe(3_600_000);
    expect(ENV.RATE_LIMIT_WINDOW_MS).toBe(3_600_000);
    expect(ENV.RATE_LIMIT_MAX_ATTEMPTS).toBe(3);
  });

  it('overrides TTLs and rate limit when set via env', async () => {
    prodEnv();
    process.env.VERIFICATION_TOKEN_TTL_MS = '172800000'; // 48h
    process.env.RESET_TOKEN_TTL_MS = '7200000'; // 2h
    process.env.RATE_LIMIT_WINDOW_MS = '1800000'; // 30min
    process.env.RATE_LIMIT_MAX_ATTEMPTS = '5';

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.VERIFICATION_TOKEN_TTL_MS).toBe(172_800_000);
    expect(ENV.RESET_TOKEN_TTL_MS).toBe(7_200_000);
    expect(ENV.RATE_LIMIT_WINDOW_MS).toBe(1_800_000);
    expect(ENV.RATE_LIMIT_MAX_ATTEMPTS).toBe(5);
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

  it('populates GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL when all are present', async () => {
    prodEnv();

    const { ENV } = await import('@infra/config/env.config.js');

    expect(ENV.GOOGLE_CLIENT_ID).toBe('my-google-client-id.apps.googleusercontent.com');
    expect(ENV.GOOGLE_CLIENT_SECRET).toBe('my-google-client-secret');
    expect(ENV.GOOGLE_CALLBACK_URL).toBe('http://localhost:3000/auth/google/callback');
  });

  it('throws when GOOGLE_CLIENT_ID is missing in non-test env', async () => {
    prodEnv();
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CLIENT_ID',
    );
  });

  it('throws when GOOGLE_CLIENT_SECRET is missing in non-test env', async () => {
    prodEnv();
    delete process.env.GOOGLE_CLIENT_SECRET;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CLIENT_SECRET',
    );
  });

  it('throws when GOOGLE_CALLBACK_URL is missing in non-test env', async () => {
    prodEnv();
    delete process.env.GOOGLE_CALLBACK_URL;

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CALLBACK_URL',
    );
  });

  it('throws when GOOGLE_CALLBACK_URL is not a valid URL in non-test env', async () => {
    prodEnv();
    process.env.GOOGLE_CALLBACK_URL = 'not-a-url';

    await expect(import('@infra/config/env.config.js')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CALLBACK_URL',
    );
  });
});
