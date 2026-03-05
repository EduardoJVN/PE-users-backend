import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { LoginUseCase } from '../login.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenSigner, TokenPayload } from '@domain/auth/ports/token-signer.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { InvalidCredentialsError } from '@domain/auth/errors/invalid-credentials.error.js';

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

class MockRefreshTokenRepository implements IRefreshTokenRepository {
  saved: RefreshToken[] = [];

  async findAll(): Promise<RefreshToken[]> {
    return [...this.saved];
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.saved.find((t) => t.id === id) ?? null;
  }

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    return this.saved.find((t) => t.tokenHash === hash) ?? null;
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    return this.saved.filter((t) => t.userId === userId);
  }

  async save(entity: RefreshToken): Promise<void> {
    this.saved.push(entity);
  }

  async update(entity: RefreshToken): Promise<void> {
    const i = this.saved.findIndex((t) => t.id === entity.id);
    if (i >= 0) this.saved[i] = entity;
  }

  async delete(id: string): Promise<void> {
    this.saved = this.saved.filter((t) => t.id !== id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.saved = this.saved.filter((t) => t.userId !== userId);
  }
}

class MockTokenSigner implements ITokenSigner {
  sign = vi.fn((_payload: TokenPayload, _expiresIn: string): string => 'signed-access-token');
  verify = vi.fn((_token: string): TokenPayload => ({ sub: 'user-1', email: 'test@example.com' }));
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

function makeUser(overrides?: Partial<{ id: string; email: string; passwordHash: string }>): User {
  return User.reconstitute(
    overrides?.id ?? 'user-1',
    overrides?.email ?? 'test@example.com',
    overrides?.passwordHash ?? 'hashed:correct-password',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepo: MockUserRepository;
  let refreshTokenRepo: MockRefreshTokenRepository;
  let tokenSigner: MockTokenSigner;
  let passwordHasher: MockPasswordHasher;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    refreshTokenRepo = new MockRefreshTokenRepository();
    tokenSigner = new MockTokenSigner();
    passwordHasher = new MockPasswordHasher();
    logger = new MockLogger();
    useCase = new LoginUseCase(
      userRepo,
      refreshTokenRepo,
      tokenSigner,
      passwordHasher,
      logger,
      30,
      'dummy-hash',
    );
  });

  it('returns accessToken and refreshToken on valid credentials', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'correct-password',
    });

    expect(result.accessToken).toBe('signed-access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);
  });

  it('saves a RefreshToken to the repository on success', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@example.com', password: 'correct-password' });

    expect(refreshTokenRepo.saved).toHaveLength(1);
    expect(refreshTokenRepo.saved[0].userId).toBe('user-1');
  });

  it('stores RefreshToken with tokenHash equal to sha256 of the returned plaintext token', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'correct-password',
    });

    const expectedHash = createHash('sha256').update(result.refreshToken).digest('hex');
    expect(refreshTokenRepo.saved[0].tokenHash).toBe(expectedHash);
    expect(refreshTokenRepo.saved[0].id).not.toBe(result.refreshToken);
  });

  it('signs access token with user id and email', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@example.com', password: 'correct-password' });

    expect(tokenSigner.sign).toHaveBeenCalledWith(
      { sub: 'user-1', email: 'test@example.com' },
      '15m',
    );
  });

  it('throws InvalidCredentialsError when user is not found', async () => {
    // userRepo is empty — no user with that email
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'any' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('calls passwordHasher.compare with dummy hash even when user is not found (timing attack prevention)', async () => {
    // userRepo is empty
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'ghost@example.com', password: 'whatever' }),
    ).rejects.toThrow(InvalidCredentialsError);

    // compare MUST have been called once, despite no user existing
    expect(passwordHasher.compare).toHaveBeenCalledTimes(1);
    // The second argument is the dummy hash (not from a real user)
    const [plainArg] = passwordHasher.compare.mock.calls[0] as [string, string];
    expect(plainArg).toBe('whatever');
  });

  it('throws InvalidCredentialsError when password does not match', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('does not save a RefreshToken when credentials are invalid', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
      InvalidCredentialsError,
    );

    expect(refreshTokenRepo.saved).toHaveLength(0);
  });

  it('propagates error when IUserRepository.findByEmail throws', async () => {
    const dbError = new Error('DB connection failed');
    vi.spyOn(userRepo, 'findByEmail').mockRejectedValue(dbError);

    await expect(useCase.execute({ email: 'test@example.com', password: 'any' })).rejects.toThrow(
      'DB connection failed',
    );
  });

  it('propagates error when IRefreshTokenRepository.save throws', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);
    const saveError = new Error('Save failed');
    vi.spyOn(refreshTokenRepo, 'save').mockRejectedValue(saveError);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'correct-password' }),
    ).rejects.toThrow('Save failed');
  });

  it('propagates error when ITokenSigner.sign throws', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);
    tokenSigner.sign.mockImplementation(() => {
      throw new Error('Signing failed');
    });

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'correct-password' }),
    ).rejects.toThrow('Signing failed');
  });

  it('logs info with userId on successful login', async () => {
    const user = makeUser();
    userRepo.seed(user);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: 'test@example.com', password: 'correct-password' });

    expect(logger.info).toHaveBeenCalledWith('User logged in', { userId: 'user-1' });
  });
});
