import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyEmailUseCase } from '../verify-email.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { EmailVerificationTokenInvalidError } from '@domain/auth/errors/email-verification-token-invalid.error.js';
import { EmailVerificationTokenExpiredError } from '@domain/auth/errors/email-verification-token-expired.error.js';
import { UserAlreadyVerifiedError } from '@domain/auth/errors/user-already-verified.error.js';
import { createHash } from 'node:crypto';

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
  private store: EmailVerificationToken[] = [];

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.store.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async save(entity: EmailVerificationToken): Promise<void> {
    this.store = this.store.filter((t) => t.userId !== entity.userId);
    this.store.push(entity);
  }

  async delete(userId: string): Promise<void> {
    this.store = this.store.filter((t) => t.userId !== userId);
  }

  seed(token: EmailVerificationToken): void {
    this.store.push(token);
  }

  getAll(): EmailVerificationToken[] {
    return [...this.store];
  }
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAINTEXT_TOKEN = 'plaintext-test-token-uuid';
const TOKEN_HASH = createHash('sha256').update(PLAINTEXT_TOKEN).digest('hex');
const USER_ID = 'user-1';
const ACTIVE_STATUS_ID = 2;

function makePendingUser(overrides?: Partial<{ id: string; isActive: boolean }>): User {
  return User.reconstitute(
    overrides?.id ?? USER_ID,
    'test@example.com',
    'hashed:password',
    'Test',
    'User',
    null,
    1, // statusId 1 = pending
    1,
    1,
    overrides?.isActive ?? false,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

function makeToken(overrides?: {
  tokenHash?: string;
  type?: 'VERIFY' | 'RESET';
  expiresAt?: Date;
  usedAt?: Date | null;
}): EmailVerificationToken {
  const expiresAt = overrides?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const token = EmailVerificationToken.reconstitute(
    'token-id-1',
    USER_ID,
    overrides?.tokenHash ?? TOKEN_HASH,
    overrides?.type ?? 'VERIFY',
    expiresAt,
    overrides?.usedAt !== undefined ? overrides.usedAt : null,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
  return token;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;
  let userRepo: MockUserRepository;
  let evtRepo: MockEmailVerificationTokenRepository;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    evtRepo = new MockEmailVerificationTokenRepository();
    logger = new MockLogger();
    useCase = new VerifyEmailUseCase(userRepo, evtRepo, logger, ACTIVE_STATUS_ID);
  });

  it('happy path: activates user, deletes token, returns success message', async () => {
    const user = makePendingUser();
    const token = makeToken();
    userRepo.seed(user);
    evtRepo.seed(token);

    const result = await useCase.execute({ token: PLAINTEXT_TOKEN });

    expect(result.message).toBe('Email verified successfully');
    // user should be updated (isActive = true)
    const updatedUser = await userRepo.findById(USER_ID);
    expect(updatedUser?.isActive).toBe(true);
    expect(updatedUser?.statusId).toBe(ACTIVE_STATUS_ID);
    // token should be deleted
    expect(evtRepo.getAll()).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith('Email verified', { userId: USER_ID });
  });

  it('throws EmailVerificationTokenInvalidError when token hash not found', async () => {
    // evtRepo is empty

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      EmailVerificationTokenInvalidError,
    );
  });

  it('throws EmailVerificationTokenInvalidError when token type is RESET', async () => {
    const user = makePendingUser();
    const token = makeToken({ type: 'RESET' });
    userRepo.seed(user);
    evtRepo.seed(token);

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      EmailVerificationTokenInvalidError,
    );
  });

  it('throws EmailVerificationTokenExpiredError when token is expired', async () => {
    const user = makePendingUser();
    const token = makeToken({ expiresAt: new Date(Date.now() - 1000) });
    userRepo.seed(user);
    evtRepo.seed(token);

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      EmailVerificationTokenExpiredError,
    );
  });

  it('throws EmailVerificationTokenInvalidError when token is already used', async () => {
    const user = makePendingUser();
    const token = makeToken({ usedAt: new Date('2024-01-02') });
    userRepo.seed(user);
    evtRepo.seed(token);

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      EmailVerificationTokenInvalidError,
    );
  });

  it('throws UserAlreadyVerifiedError when user.isActive is true', async () => {
    const alreadyActiveUser = makePendingUser({ isActive: true });
    const token = makeToken();
    userRepo.seed(alreadyActiveUser);
    evtRepo.seed(token);

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      UserAlreadyVerifiedError,
    );
  });

  it('throws EmailVerificationTokenInvalidError when user not found in repo after token found', async () => {
    // Token exists but no user with that userId in userRepo
    const token = makeToken();
    evtRepo.seed(token);
    // userRepo is empty

    await expect(useCase.execute({ token: PLAINTEXT_TOKEN })).rejects.toThrow(
      EmailVerificationTokenInvalidError,
    );
  });
});
