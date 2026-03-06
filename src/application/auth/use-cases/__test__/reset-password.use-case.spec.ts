import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ResetPasswordUseCase } from '../reset-password.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';
import { EmailVerificationTokenInvalidError } from '@domain/auth/errors/email-verification-token-invalid.error.js';
import { EmailVerificationTokenExpiredError } from '@domain/auth/errors/email-verification-token-expired.error.js';

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
    this.store.push(entity);
  }

  async delete(userId: string): Promise<void> {
    this.store = this.store.filter((t) => t.userId !== userId);
  }

  seed(token: EmailVerificationToken): void {
    this.store.push(token);
  }

  getStore(): EmailVerificationToken[] {
    return [...this.store];
  }
}

class MockPasswordHasher implements IPasswordHasher {
  hash = vi.fn(async (plain: string): Promise<string> => `hashed:${plain}`);
  compare = vi.fn(async (_plain: string, _hash: string): Promise<boolean> => true);
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STRONG_PASS = 'StrongP@ssw0rd';
const PLAINTEXT_TOKEN = 'plain-test-token-abc';
const TOKEN_HASH = createHash('sha256').update(PLAINTEXT_TOKEN).digest('hex');

function makeUser(id = 'user-1'): User {
  return User.reconstitute(
    id,
    'test@example.com',
    'bcrypt:stored-hash',
    'Test',
    'User',
    null,
    2,
    1,
    1,
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

function makeResetToken(overrides?: {
  userId?: string;
  type?: 'VERIFY' | 'RESET';
  expiresAt?: Date;
  usedAt?: Date | null;
}): EmailVerificationToken {
  const expiresAt = overrides?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const usedAt = overrides?.usedAt !== undefined ? overrides.usedAt : null;
  return EmailVerificationToken.reconstitute(
    'token-id-1',
    overrides?.userId ?? 'user-1',
    TOKEN_HASH,
    overrides?.type ?? 'RESET',
    expiresAt,
    usedAt,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let userRepo: MockUserRepository;
  let evtRepo: MockEmailVerificationTokenRepository;
  let passwordHasher: MockPasswordHasher;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    evtRepo = new MockEmailVerificationTokenRepository();
    passwordHasher = new MockPasswordHasher();
    logger = new MockLogger();
    useCase = new ResetPasswordUseCase(userRepo, evtRepo, passwordHasher, logger);
  });

  describe('happy path', () => {
    it('updates user password, deletes token, and returns success message', async () => {
      const user = makeUser();
      userRepo.seed(user);
      evtRepo.seed(makeResetToken());

      const result = await useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS });

      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('hashes the new password before saving', async () => {
      const user = makeUser();
      userRepo.seed(user);
      evtRepo.seed(makeResetToken());

      await useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS });

      expect(passwordHasher.hash).toHaveBeenCalledWith(STRONG_PASS);
      const updated = await userRepo.findById('user-1');
      expect(updated?.password).toBe(`hashed:${STRONG_PASS}`);
    });

    it('deletes the token after password is updated', async () => {
      const user = makeUser();
      userRepo.seed(user);
      evtRepo.seed(makeResetToken());

      await useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS });

      expect(evtRepo.getStore()).toHaveLength(0);
    });

    it('logs info with userId on success', async () => {
      const user = makeUser();
      userRepo.seed(user);
      evtRepo.seed(makeResetToken());

      await useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS });

      expect(logger.info).toHaveBeenCalledWith('Password reset', { userId: 'user-1' });
    });
  });

  describe('password validation', () => {
    it('throws PasswordTooWeakError when password is too short', async () => {
      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: 'Sh0rt!' }),
      ).rejects.toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when password has no uppercase letter', async () => {
      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: 'nouppercase1!' }),
      ).rejects.toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when password has no number', async () => {
      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: 'NoNumbers!' }),
      ).rejects.toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when password has no special character', async () => {
      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: 'NoSpecial1A' }),
      ).rejects.toThrow(PasswordTooWeakError);
    });

    it('does not look up token when password is too weak', async () => {
      const findByHashSpy = vi.spyOn(evtRepo, 'findByTokenHash');

      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: 'weak' }),
      ).rejects.toThrow(PasswordTooWeakError);

      expect(findByHashSpy).not.toHaveBeenCalled();
    });
  });

  describe('token validation', () => {
    it('throws EmailVerificationTokenInvalidError when token hash is not found', async () => {
      // evtRepo is empty
      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS }),
      ).rejects.toThrow(EmailVerificationTokenInvalidError);
    });

    it('throws EmailVerificationTokenInvalidError when token type is VERIFY (not RESET)', async () => {
      evtRepo.seed(makeResetToken({ type: 'VERIFY' }));

      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS }),
      ).rejects.toThrow(EmailVerificationTokenInvalidError);
    });

    it('throws EmailVerificationTokenExpiredError when token is expired', async () => {
      const expiredToken = makeResetToken({ expiresAt: new Date(Date.now() - 1000) });
      evtRepo.seed(expiredToken);

      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS }),
      ).rejects.toThrow(EmailVerificationTokenExpiredError);
    });

    it('throws EmailVerificationTokenInvalidError when token has already been used', async () => {
      const usedToken = makeResetToken({ usedAt: new Date('2024-01-01') });
      evtRepo.seed(usedToken);

      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS }),
      ).rejects.toThrow(EmailVerificationTokenInvalidError);
    });

    it('throws EmailVerificationTokenInvalidError when user associated with token is not found', async () => {
      // Token exists but user was deleted
      evtRepo.seed(makeResetToken({ userId: 'non-existent-user' }));

      await expect(
        useCase.execute({ token: PLAINTEXT_TOKEN, newPassword: STRONG_PASS }),
      ).rejects.toThrow(EmailVerificationTokenInvalidError);
    });
  });
});
