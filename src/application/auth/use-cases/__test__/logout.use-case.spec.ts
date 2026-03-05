import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutUseCase } from '../logout.use-case.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenBlacklist } from '@domain/auth/ports/token-blacklist.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

class MockRefreshTokenRepository implements IRefreshTokenRepository {
  private store: RefreshToken[] = [];
  deletedIds: string[] = [];

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
    this.deletedIds.push(id);
    this.store = this.store.filter((t) => t.id !== id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.store = this.store.filter((t) => t.userId !== userId);
  }

  seed(token: RefreshToken): void {
    this.store.push(token);
  }
}

class MockTokenBlacklist implements ITokenBlacklist {
  addCalled = false;
  addedToken: string | null = null;
  addedExpiry: Date | null = null;

  async add(token: string, expiresAt: Date): Promise<void> {
    this.addCalled = true;
    this.addedToken = token;
    this.addedExpiry = expiresAt;
  }

  async isBlacklisted(_token: string): Promise<boolean> {
    return false;
  }
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

function makeValidToken(id = 'token-1', userId = 'user-1'): RefreshToken {
  return RefreshToken.reconstitute(
    id,
    userId,
    'hashed:uuid',
    makeFutureDate(),
    null,
    new Date('2024-01-01'),
  );
}

function makeUsedToken(id = 'token-1', userId = 'user-1'): RefreshToken {
  return RefreshToken.reconstitute(
    id,
    userId,
    'hashed:uuid',
    makeFutureDate(),
    new Date('2024-01-02'),
    new Date('2024-01-01'),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let refreshTokenRepo: MockRefreshTokenRepository;
  let tokenBlacklist: MockTokenBlacklist;
  let logger: MockLogger;

  beforeEach(() => {
    refreshTokenRepo = new MockRefreshTokenRepository();
    tokenBlacklist = new MockTokenBlacklist();
    logger = new MockLogger();
    useCase = new LogoutUseCase(refreshTokenRepo, tokenBlacklist, logger);
  });

  it('deletes the refresh token and blacklists the access token when both are provided', async () => {
    refreshTokenRepo.seed(makeValidToken());

    await useCase.execute({ refreshToken: 'token-1', accessToken: 'jwt-access-token' });

    expect(refreshTokenRepo.deletedIds).toContain('token-1');
    expect(tokenBlacklist.addCalled).toBe(true);
    expect(tokenBlacklist.addedToken).toBe('jwt-access-token');
  });

  it('deletes the refresh token but does NOT call tokenBlacklist when no accessToken provided', async () => {
    refreshTokenRepo.seed(makeValidToken());

    await useCase.execute({ refreshToken: 'token-1' });

    expect(refreshTokenRepo.deletedIds).toContain('token-1');
    expect(tokenBlacklist.addCalled).toBe(false);
  });

  it('returns void without throwing when token is not found (idempotent)', async () => {
    // repo is empty
    await expect(
      useCase.execute({ refreshToken: 'nonexistent-token', accessToken: 'some-jwt' }),
    ).resolves.toBeUndefined();
  });

  it('does NOT call tokenBlacklist when token is not found', async () => {
    await useCase.execute({ refreshToken: 'nonexistent-token', accessToken: 'some-jwt' });

    expect(tokenBlacklist.addCalled).toBe(false);
  });

  it('does NOT log when token is not found', async () => {
    await useCase.execute({ refreshToken: 'nonexistent-token' });

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('deletes an already-used token (idempotent cleanup)', async () => {
    refreshTokenRepo.seed(makeUsedToken());

    await useCase.execute({ refreshToken: 'token-1' });

    expect(refreshTokenRepo.deletedIds).toContain('token-1');
  });

  it('logs info with userId on successful logout', async () => {
    refreshTokenRepo.seed(makeValidToken('token-1', 'user-42'));

    await useCase.execute({ refreshToken: 'token-1' });

    expect(logger.info).toHaveBeenCalledWith('User logged out', { userId: 'user-42' });
  });

  it('propagates error when IRefreshTokenRepository.delete throws', async () => {
    refreshTokenRepo.seed(makeValidToken());
    vi.spyOn(refreshTokenRepo, 'delete').mockRejectedValue(new Error('Delete failed'));

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow('Delete failed');
  });

  it('propagates error when IRefreshTokenRepository.findById throws', async () => {
    vi.spyOn(refreshTokenRepo, 'findById').mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute({ refreshToken: 'token-1' })).rejects.toThrow('DB error');
  });
});
