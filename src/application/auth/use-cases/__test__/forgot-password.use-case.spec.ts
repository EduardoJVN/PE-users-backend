import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ForgotPasswordUseCase } from '../forgot-password.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IEmailSender } from '@domain/ports/email-sender.port.js';
import type { IRateLimiter } from '@domain/ports/rate-limiter.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { RateLimitExceededError } from '@domain/auth/errors/rate-limit-exceeded.error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

class MockUserRepository implements IUserRepository {
  private store: User[] = [];

  async findAll(): Promise<User[]> {
    return [...this.store];
  }

  async findById(id: string): Promise<User | null> {
    return this.store.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.store.find((u) => u.email === email) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.store.find((u) => u.googleId === googleId) ?? null;
  }

  async save(entity: User): Promise<void> {
    this.store.push(entity);
  }

  async update(entity: User): Promise<void> {
    const i = this.store.findIndex((u) => u.id === entity.id);
    if (i >= 0) this.store[i] = entity;
  }

  async delete(id: string): Promise<void> {
    this.store = this.store.filter((u) => u.id !== id);
  }

  seed(user: User): void {
    this.store.push(user);
  }
}

class MockEmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  saved: EmailVerificationToken[] = [];

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.saved.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async save(entity: EmailVerificationToken): Promise<void> {
    this.saved.push(entity);
  }

  async delete(userId: string): Promise<void> {
    this.saved = this.saved.filter((t) => t.userId !== userId);
  }
}

class MockEmailSender implements IEmailSender {
  sendVerificationEmail = vi.fn(async (): Promise<void> => {});
  sendPasswordResetEmail = vi.fn(async (): Promise<void> => {});
}

class MockRateLimiter implements IRateLimiter {
  checkAndIncrement = vi.fn(async (): Promise<boolean> => true);
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(): User {
  return User.reconstitute(
    'user-1',
    'test@example.com',
    'hashed:password',
    'Test',
    'User',
    null,
    2,
    1,
    1,
    null,
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

const RESET_BASE_URL = 'http://localhost:3000/auth/reset-password';
const TOKEN_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  let userRepo: MockUserRepository;
  let evtRepo: MockEmailVerificationTokenRepository;
  let emailSender: MockEmailSender;
  let rateLimiter: MockRateLimiter;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    evtRepo = new MockEmailVerificationTokenRepository();
    emailSender = new MockEmailSender();
    rateLimiter = new MockRateLimiter();
    logger = new MockLogger();
    useCase = new ForgotPasswordUseCase(
      userRepo,
      evtRepo,
      emailSender,
      rateLimiter,
      logger,
      RESET_BASE_URL,
      TOKEN_TTL_MS,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX,
    );
  });

  it('saves a RESET token and sends reset email when user is found', async () => {
    const user = makeUser();
    userRepo.seed(user);

    await useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' });

    expect(evtRepo.saved).toHaveLength(1);
    expect(evtRepo.saved[0].type).toBe('RESET');
    expect(evtRepo.saved[0].userId).toBe('user-1');

    expect(emailSender.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [params] = emailSender.sendPasswordResetEmail.mock.calls[0] as [
      { to: string; resetUrl: string },
    ];
    expect(params.to).toBe('test@example.com');
    expect(params.resetUrl).toContain(RESET_BASE_URL);
    expect(params.resetUrl).toContain('?token=');
  });

  it('stores token with tokenHash equal to sha256 of the plaintext token in the email URL', async () => {
    const user = makeUser();
    userRepo.seed(user);

    await useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' });

    const [params] = emailSender.sendPasswordResetEmail.mock.calls[0] as [
      { to: string; resetUrl: string },
    ];
    const urlParams = new URL(params.resetUrl);
    const plaintextToken = urlParams.searchParams.get('token') ?? '';
    const expectedHash = createHash('sha256').update(plaintextToken).digest('hex');

    expect(evtRepo.saved[0].tokenHash).toBe(expectedHash);
  });

  it('logs info with userId on success', async () => {
    const user = makeUser();
    userRepo.seed(user);

    await useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' });

    expect(logger.info).toHaveBeenCalledWith('Password reset email sent', { userId: 'user-1' });
  });

  it('returns silently without saving token or sending email when email is not found (anti-enumeration)', async () => {
    // userRepo is empty — no user with that email
    await expect(
      useCase.execute({ email: 'unknown@example.com', rateLimitKey: 'reset:unknown-ip' }),
    ).resolves.toBeUndefined();

    expect(evtRepo.saved).toHaveLength(0);
    expect(emailSender.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('throws RateLimitExceededError when rate limit is exceeded', async () => {
    rateLimiter.checkAndIncrement.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' }),
    ).rejects.toThrow(RateLimitExceededError);
  });

  it('sets retryAfterSeconds equal to rateLimitWindowMs in seconds when rate limit exceeded', async () => {
    rateLimiter.checkAndIncrement.mockResolvedValue(false);

    let caught: RateLimitExceededError | undefined;
    try {
      await useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' });
    } catch (err) {
      caught = err as RateLimitExceededError;
    }

    expect(caught).toBeInstanceOf(RateLimitExceededError);
    expect(caught?.retryAfterSeconds).toBe(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
  });

  it('propagates error when emailSender.sendPasswordResetEmail throws (only when user is found)', async () => {
    const user = makeUser();
    userRepo.seed(user);
    emailSender.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP error'));

    await expect(
      useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' }),
    ).rejects.toThrow('SMTP error');
  });

  it('does NOT check rate limit before checking if user is found — rate limit is checked first', async () => {
    // rate limit returns false → should throw before even looking up user
    rateLimiter.checkAndIncrement.mockResolvedValue(false);
    const findByEmailSpy = vi.spyOn(userRepo, 'findByEmail');

    await expect(
      useCase.execute({ email: 'test@example.com', rateLimitKey: 'reset:user-ip' }),
    ).rejects.toThrow(RateLimitExceededError);

    expect(findByEmailSpy).not.toHaveBeenCalled();
  });
});
