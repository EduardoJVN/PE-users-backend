import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendVerificationEmailUseCase } from '../resend-verification-email.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IEmailSender, SendVerificationEmailParams } from '@domain/ports/email-sender.port.js';
import type { IRateLimiter } from '@domain/ports/rate-limiter.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { UserAlreadyVerifiedError } from '@domain/auth/errors/user-already-verified.error.js';
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
    this.saved = this.saved.filter((t) => t.userId !== entity.userId);
    this.saved.push(entity);
  }

  async delete(userId: string): Promise<void> {
    this.saved = this.saved.filter((t) => t.userId !== userId);
  }
}

class MockEmailSender implements IEmailSender {
  sendVerificationEmail = vi.fn(async (_params: SendVerificationEmailParams): Promise<void> => {});
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

const USER_ID = 'user-1';
const RATE_LIMIT_KEY = 'resend:userId:user-1';
const VERIFICATION_BASE_URL = 'https://example.com/verify';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = 3;

function makePendingUser(overrides?: Partial<{ id: string; isActive: boolean }>): User {
  return User.reconstitute(
    overrides?.id ?? USER_ID,
    'test@example.com',
    'hashed:password',
    'Test',
    'User',
    null,
    1,
    1,
    1,
    overrides?.isActive ?? false,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ResendVerificationEmailUseCase', () => {
  let useCase: ResendVerificationEmailUseCase;
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
    useCase = new ResendVerificationEmailUseCase(
      userRepo,
      evtRepo,
      emailSender,
      rateLimiter,
      logger,
      VERIFICATION_BASE_URL,
      TOKEN_TTL_MS,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX,
    );
  });

  it('happy path: saves new token, sends email, returns success message', async () => {
    const user = makePendingUser();
    userRepo.seed(user);

    const result = await useCase.execute({ userId: USER_ID, rateLimitKey: RATE_LIMIT_KEY });

    expect(result.message).toBe('If your account exists, a verification email has been sent');
    expect(evtRepo.saved).toHaveLength(1);
    expect(evtRepo.saved[0].userId).toBe(USER_ID);
    expect(evtRepo.saved[0].type).toBe('VERIFY');
    expect(emailSender.sendVerificationEmail).toHaveBeenCalledOnce();
    const callArgs = emailSender.sendVerificationEmail.mock.calls[0][0] as SendVerificationEmailParams;
    expect(callArgs.to).toBe('test@example.com');
    expect(callArgs.verificationUrl).toContain(VERIFICATION_BASE_URL);
    expect(callArgs.verificationUrl).toContain('?token=');
    expect(logger.info).toHaveBeenCalledWith('Verification email resent', { userId: USER_ID });
  });

  it('returns silent message when user not found (anti-enumeration)', async () => {
    // userRepo is empty

    const result = await useCase.execute({ userId: 'unknown-user', rateLimitKey: RATE_LIMIT_KEY });

    expect(result.message).toBe('If your account exists, a verification email has been sent');
    expect(emailSender.sendVerificationEmail).not.toHaveBeenCalled();
    expect(evtRepo.saved).toHaveLength(0);
  });

  it('throws UserAlreadyVerifiedError when user is already active', async () => {
    const activeUser = makePendingUser({ isActive: true });
    userRepo.seed(activeUser);

    await expect(
      useCase.execute({ userId: USER_ID, rateLimitKey: RATE_LIMIT_KEY }),
    ).rejects.toThrow(UserAlreadyVerifiedError);
  });

  it('throws RateLimitExceededError when rate limit is exceeded', async () => {
    const user = makePendingUser();
    userRepo.seed(user);
    rateLimiter.checkAndIncrement.mockResolvedValue(false);

    await expect(
      useCase.execute({ userId: USER_ID, rateLimitKey: RATE_LIMIT_KEY }),
    ).rejects.toThrow(RateLimitExceededError);
  });

  it('RateLimitExceededError contains retryAfterSeconds from rateLimitWindowMs', async () => {
    const user = makePendingUser();
    userRepo.seed(user);
    rateLimiter.checkAndIncrement.mockResolvedValue(false);

    const error = await useCase.execute({ userId: USER_ID, rateLimitKey: RATE_LIMIT_KEY }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitExceededError);
    expect((error as RateLimitExceededError).retryAfterSeconds).toBe(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
  });

  it('propagates error if emailSender throws', async () => {
    const user = makePendingUser();
    userRepo.seed(user);
    emailSender.sendVerificationEmail.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(
      useCase.execute({ userId: USER_ID, rateLimitKey: RATE_LIMIT_KEY }),
    ).rejects.toThrow('SMTP unavailable');
  });
});
