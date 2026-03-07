import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { GoogleOAuthCallbackUseCase } from '../google-oauth-callback.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenSigner, TokenPayload } from '@domain/auth/ports/token-signer.port.js';
import type { IGoogleOAuthPort, GoogleProfile } from '@domain/auth/ports/google-oauth.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';

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

  getStore(): User[] {
    return [...this.store];
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

class MockGoogleOAuthPort implements IGoogleOAuthPort {
  getAuthUrl = vi.fn((): string => 'https://accounts.google.com/o/oauth2/auth?client_id=test');
  getProfile = vi.fn(
    async (_code: string): Promise<GoogleProfile> => ({
      googleId: 'google-123',
      email: 'alice@example.com',
      name: 'Alice',
      lastName: 'Smith',
      avatarUrl: null,
    }),
  );
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeActiveUser(
  overrides?: Partial<{ id: string; email: string; googleId: string | null }>,
): User {
  return User.reconstitute(
    overrides?.id ?? 'user-1',
    overrides?.email ?? 'alice@example.com',
    null,
    'Alice',
    'Smith',
    null,
    2, // ACTIVE
    1,
    2, // GOOGLE
    overrides?.googleId ?? 'google-123',
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

function makeEmailUser(overrides?: Partial<{ id: string; email: string }>): User {
  return User.reconstitute(
    overrides?.id ?? 'user-email-1',
    overrides?.email ?? 'alice@example.com',
    'hashed:password',
    'Alice',
    'Smith',
    null,
    2, // ACTIVE
    1,
    1, // EMAIL
    null,
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GoogleOAuthCallbackUseCase', () => {
  let useCase: GoogleOAuthCallbackUseCase;
  let userRepo: MockUserRepository;
  let refreshTokenRepo: MockRefreshTokenRepository;
  let tokenSigner: MockTokenSigner;
  let googleOAuth: MockGoogleOAuthPort;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    refreshTokenRepo = new MockRefreshTokenRepository();
    tokenSigner = new MockTokenSigner();
    googleOAuth = new MockGoogleOAuthPort();
    logger = new MockLogger();
    useCase = new GoogleOAuthCallbackUseCase(
      userRepo,
      refreshTokenRepo,
      tokenSigner,
      googleOAuth,
      logger,
      30,
    );
  });

  describe('Branch A: returning Google user', () => {
    it('returns tokens when user already has this googleId', async () => {
      const user = makeActiveUser({ googleId: 'google-123' });
      userRepo.seed(user);

      const result = await useCase.execute({ code: 'auth-code' });

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.userId).toBe(user.id);
    });

    it('saves a refresh token for the returning user', async () => {
      const user = makeActiveUser({ googleId: 'google-123' });
      userRepo.seed(user);

      await useCase.execute({ code: 'auth-code' });

      expect(refreshTokenRepo.saved).toHaveLength(1);
      expect(refreshTokenRepo.saved[0].userId).toBe(user.id);
    });

    it('stores refresh token hash equal to sha256 of the returned plaintext token', async () => {
      const user = makeActiveUser({ googleId: 'google-123' });
      userRepo.seed(user);

      const result = await useCase.execute({ code: 'auth-code' });

      const expectedHash = createHash('sha256').update(result.refreshToken).digest('hex');
      expect(refreshTokenRepo.saved[0].tokenHash).toBe(expectedHash);
    });

    it('signs access token with user id and email', async () => {
      const user = makeActiveUser({ id: 'user-42', googleId: 'google-123' });
      userRepo.seed(user);

      await useCase.execute({ code: 'auth-code' });

      expect(tokenSigner.sign).toHaveBeenCalledWith(
        { sub: 'user-42', email: 'alice@example.com' },
        '15m',
      );
    });

    it('logs info with userId', async () => {
      const user = makeActiveUser({ id: 'user-42', googleId: 'google-123' });
      userRepo.seed(user);

      await useCase.execute({ code: 'auth-code' });

      expect(logger.info).toHaveBeenCalledWith('Google OAuth: returning user', {
        userId: 'user-42',
      });
    });

    it('does not call findByEmail when googleId match is found', async () => {
      const user = makeActiveUser({ googleId: 'google-123' });
      userRepo.seed(user);
      const findByEmailSpy = vi.spyOn(userRepo, 'findByEmail');

      await useCase.execute({ code: 'auth-code' });

      expect(findByEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('Branch B: email exists — link Google account', () => {
    it('links googleId to existing user and returns tokens', async () => {
      const emailUser = makeEmailUser({ email: 'alice@example.com' });
      userRepo.seed(emailUser);
      // No user with googleId 'google-123'

      const result = await useCase.execute({ code: 'auth-code' });

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.userId).toBe(emailUser.id);
    });

    it('updates the existing user with the new googleId', async () => {
      const emailUser = makeEmailUser({ id: 'user-email-1', email: 'alice@example.com' });
      userRepo.seed(emailUser);

      await useCase.execute({ code: 'auth-code' });

      const updatedUser = await userRepo.findById('user-email-1');
      expect(updatedUser!.googleId).toBe('google-123');
    });

    it('saves a refresh token for the linked user', async () => {
      const emailUser = makeEmailUser({ id: 'user-email-1', email: 'alice@example.com' });
      userRepo.seed(emailUser);

      await useCase.execute({ code: 'auth-code' });

      expect(refreshTokenRepo.saved).toHaveLength(1);
      expect(refreshTokenRepo.saved[0].userId).toBe('user-email-1');
    });

    it('logs info about linking', async () => {
      const emailUser = makeEmailUser({ id: 'user-email-1', email: 'alice@example.com' });
      userRepo.seed(emailUser);

      await useCase.execute({ code: 'auth-code' });

      expect(logger.info).toHaveBeenCalledWith(
        'Google OAuth: linked Google account to existing user',
        { userId: 'user-email-1' },
      );
    });

    it('does not create a new user when linking', async () => {
      const emailUser = makeEmailUser({ email: 'alice@example.com' });
      userRepo.seed(emailUser);
      const initialCount = userRepo.getStore().length;

      await useCase.execute({ code: 'auth-code' });

      expect(userRepo.getStore()).toHaveLength(initialCount);
    });
  });

  describe('Branch C: new user', () => {
    it('creates a new user and returns tokens', async () => {
      // userRepo is empty — no googleId, no email match

      const result = await useCase.execute({ code: 'auth-code' });

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.userId.length).toBeGreaterThan(0);
    });

    it('saves the new user to the repository', async () => {
      await useCase.execute({ code: 'auth-code' });

      const user = await userRepo.findByEmail('alice@example.com');
      expect(user).not.toBeNull();
      expect(user!.googleId).toBe('google-123');
    });

    it('creates the new user as active (isActive=true)', async () => {
      await useCase.execute({ code: 'auth-code' });

      const user = await userRepo.findByEmail('alice@example.com');
      expect(user!.isActive).toBe(true);
    });

    it('creates the new user with GOOGLE registerTypeId', async () => {
      await useCase.execute({ code: 'auth-code' });

      const user = await userRepo.findByEmail('alice@example.com');
      expect(user!.registerTypeId).toBe(2); // RegisterTypeId.GOOGLE
    });

    it('creates the new user with null password', async () => {
      await useCase.execute({ code: 'auth-code' });

      const user = await userRepo.findByEmail('alice@example.com');
      expect(user!.password).toBeNull();
    });

    it('saves a refresh token for the new user', async () => {
      const result = await useCase.execute({ code: 'auth-code' });

      expect(refreshTokenRepo.saved).toHaveLength(1);
      expect(refreshTokenRepo.saved[0].userId).toBe(result.userId);
    });

    it('logs info about new user registration', async () => {
      const result = await useCase.execute({ code: 'auth-code' });

      expect(logger.info).toHaveBeenCalledWith('Google OAuth: new user registered', {
        userId: result.userId,
      });
    });
  });

  describe('error cases', () => {
    it('propagates error when googleOAuth.getProfile throws', async () => {
      googleOAuth.getProfile.mockRejectedValue(new Error('Invalid Google code'));

      await expect(useCase.execute({ code: 'bad-code' })).rejects.toThrow('Invalid Google code');
    });

    it('propagates error when userRepo.findByGoogleId throws', async () => {
      vi.spyOn(userRepo, 'findByGoogleId').mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute({ code: 'auth-code' })).rejects.toThrow('DB error');
    });

    it('propagates error when userRepo.save throws for new user', async () => {
      vi.spyOn(userRepo, 'save').mockRejectedValue(new Error('Save failed'));

      await expect(useCase.execute({ code: 'auth-code' })).rejects.toThrow('Save failed');
    });

    it('propagates error when refreshTokenRepo.save throws', async () => {
      vi.spyOn(refreshTokenRepo, 'save').mockRejectedValue(new Error('Token save failed'));

      await expect(useCase.execute({ code: 'auth-code' })).rejects.toThrow('Token save failed');
    });
  });
});
