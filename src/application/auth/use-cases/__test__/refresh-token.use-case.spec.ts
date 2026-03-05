import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { RefreshTokenUseCase } from '../refresh-token.use-case.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ITokenSigner, TokenPayload } from '@domain/auth/ports/token-signer.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { User } from '@domain/user/entities/user.entity.js';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

class MockRefreshTokenRepository implements IRefreshTokenRepository {
  private store: RefreshToken[] = [];
  deleteByUserIdCalled = false;
  deletedUserId: string | null = null;

  async findAll(): Promise<RefreshToken[]> {
    return [...this.store];
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.store.find((t) => t.id === id) ?? null;
  }

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    return this.store.find((t) => t.tokenHash === hash) ?? null;
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    return this.store.filter((t) => t.userId === userId);
  }

  async save(entity: RefreshToken): Promise<void> {
    this.store.push(entity);
  }

  async update(entity: RefreshToken): Promise<void> {
    const i = this.store.findIndex((t) => t.id === entity.id);
    if (i >= 0) this.store[i] = entity;
  }

  async delete(id: string): Promise<void> {
    this.store = this.store.filter((t) => t.id !== id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.deleteByUserIdCalled = true;
    this.deletedUserId = userId;
    this.store = this.store.filter((t) => t.userId !== userId);
  }

  seed(token: RefreshToken): void {
    this.store.push(token);
  }

  get saved(): RefreshToken[] {
    return this.store;
  }
}

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

class MockTokenSigner implements ITokenSigner {
  sign = vi.fn((_payload: TokenPayload, _expiresIn: string): string => 'new-access-token');
  verify = vi.fn((_token: string): TokenPayload => ({ sub: 'user-1', email: 'test@example.com' }));
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFutureDate(days = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function makePastDate(daysAgo = 1): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// plaintextToken is the cookie value; id is the UUID v7 PK (separate)
function makeValidToken(plaintextToken = 'token-1', userId = 'user-1'): RefreshToken {
  return RefreshToken.reconstitute(
    `id-of-${plaintextToken}`,
    userId,
    sha256(plaintextToken),
    makeFutureDate(),
    null,
    new Date('2024-01-01'),
  );
}

function makeExpiredToken(plaintextToken = 'token-1', userId = 'user-1'): RefreshToken {
  return RefreshToken.reconstitute(
    `id-of-${plaintextToken}`,
    userId,
    sha256(plaintextToken),
    makePastDate(),
    null,
    new Date('2024-01-01'),
  );
}

function makeUsedToken(plaintextToken = 'token-1', userId = 'user-1'): RefreshToken {
  return RefreshToken.reconstitute(
    `id-of-${plaintextToken}`,
    userId,
    sha256(plaintextToken),
    makeFutureDate(),
    new Date('2024-01-02'),
    new Date('2024-01-01'),
  );
}

function makeUser(id = 'user-1', email = 'test@example.com'): User {
  return User.reconstitute(
    id,
    email,
    'hashed:password',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let refreshTokenRepo: MockRefreshTokenRepository;
  let userRepo: MockUserRepository;
  let tokenSigner: MockTokenSigner;
  let logger: MockLogger;

  beforeEach(() => {
    refreshTokenRepo = new MockRefreshTokenRepository();
    userRepo = new MockUserRepository();
    tokenSigner = new MockTokenSigner();
    logger = new MockLogger();
    useCase = new RefreshTokenUseCase(refreshTokenRepo, userRepo, tokenSigner, logger, 30);
  });

  it('returns new accessToken and refreshToken on a valid non-expired non-used token', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());

    const result = await useCase.execute({ refreshToken: 'token-1' });

    expect(result.accessToken).toBe('new-access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);
  });

  it('saves a new RefreshToken after a successful refresh', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());

    await useCase.execute({ refreshToken: 'token-1' });

    // The store started with 1 token. After refresh: the old one is updated (marked used),
    // and a new one is saved — so the total stored is 2 (old still there but marked used + new).
    const allTokens = await refreshTokenRepo.findAll();
    const newTokens = allTokens.filter((t) => t.id !== 'id-of-token-1');
    expect(newTokens).toHaveLength(1);
    expect(newTokens[0].userId).toBe('user-1');
  });

  it('stores new RefreshToken with tokenHash equal to sha256 of the returned plaintext token', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());

    const result = await useCase.execute({ refreshToken: 'token-1' });

    const allTokens = await refreshTokenRepo.findAll();
    const newToken = allTokens.find((t) => t.id !== 'id-of-token-1');
    expect(newToken).toBeDefined();
    expect(newToken!.tokenHash).toBe(sha256(result.refreshToken));
    expect(newToken!.id).not.toBe(result.refreshToken);
  });

  it('marks the old token as used before saving the new token', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());

    // Track call order
    const callOrder: string[] = [];
    vi.spyOn(refreshTokenRepo, 'update').mockImplementation(async (t: RefreshToken) => {
      callOrder.push('update');
      expect(t.isUsed()).toBe(true); // must be marked used before update
    });
    vi.spyOn(refreshTokenRepo, 'save').mockImplementation(async () => {
      callOrder.push('save');
    });

    await useCase.execute({ refreshToken: 'token-1' });

    expect(callOrder).toEqual(['update', 'save']);
  });

  it('throws RefreshTokenInvalidError when token is not found', async () => {
    // repo is empty
    await expect(useCase.execute({ refreshToken: 'nonexistent-token' })).rejects.toThrow(
      RefreshTokenInvalidError,
    );
  });

  it('throws RefreshTokenExpiredError when token is expired', async () => {
    refreshTokenRepo.seed(makeExpiredToken());

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow(
      RefreshTokenExpiredError,
    );
  });

  it('throws RefreshTokenInvalidError and calls deleteByUserId when token is already used (stolen token)', async () => {
    const usedToken = makeUsedToken('token-1', 'user-1');
    refreshTokenRepo.seed(usedToken);

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow(
      RefreshTokenInvalidError,
    );

    expect(refreshTokenRepo.deleteByUserIdCalled).toBe(true);
    expect(refreshTokenRepo.deletedUserId).toBe('user-1');
  });

  it('throws RefreshTokenInvalidError when user is not found (orphaned token)', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    // userRepo is empty — no user with id 'user-1'

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow(
      RefreshTokenInvalidError,
    );
  });

  it('signs the new access token with the user id and email', async () => {
    const token = makeValidToken('token-1', 'user-42');
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser('user-42', 'alice@example.com'));

    await useCase.execute({ refreshToken: 'token-1' });

    expect(tokenSigner.sign).toHaveBeenCalledWith(
      { sub: 'user-42', email: 'alice@example.com' },
      '15m',
    );
  });

  it('logs info with userId on successful refresh', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());

    await useCase.execute({ refreshToken: 'token-1' });

    expect(logger.info).toHaveBeenCalledWith('Token refreshed', { userId: 'user-1' });
  });

  it('propagates error when IRefreshTokenRepository.findByTokenHash throws', async () => {
    vi.spyOn(refreshTokenRepo, 'findByTokenHash').mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow('DB error');
  });

  it('propagates error when IRefreshTokenRepository.update throws', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());
    vi.spyOn(refreshTokenRepo, 'update').mockRejectedValue(new Error('Update failed'));

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow('Update failed');
  });

  it('propagates error when IRefreshTokenRepository.save throws', async () => {
    const token = makeValidToken();
    refreshTokenRepo.seed(token);
    userRepo.seed(makeUser());
    vi.spyOn(refreshTokenRepo, 'save').mockRejectedValue(new Error('Save failed'));

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow('Save failed');
  });
});
