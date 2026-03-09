import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMeUseCase } from '../get-me.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { UserNotFoundError } from '@domain/user/errors/user-not-found.error.js';

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

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeUser(): User {
  const now = new Date('2024-01-15T10:00:00.000Z');
  return User.reconstitute(
    'user-123',
    'john@example.com',
    'hashed-password',
    'John',
    'Doe',
    'https://example.com/avatar.png',
    1,
    2,
    1,
    null,
    true,
    now,
    now,
    null,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;
  let repo: MockUserRepository;
  let logger: MockLogger;

  beforeEach(() => {
    repo = new MockUserRepository();
    logger = new MockLogger();
    useCase = new GetMeUseCase(repo, logger);
  });

  it('returns a plain GetMeResult with all fields mapped from the user entity', async () => {
    const user = makeUser();
    repo.seed(user);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result).toEqual({
      id: 'user-123',
      email: 'john@example.com',
      name: 'John',
      lastName: 'Doe',
      avatarUrl: 'https://example.com/avatar.png',
      statusId: 1,
      roleId: 2,
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });

  it('does not return the entity instance — returns a plain object', async () => {
    const user = makeUser();
    repo.seed(user);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result).not.toBeInstanceOf(User);
  });

  it('logs info on successful retrieval', async () => {
    repo.seed(makeUser());
    await useCase.execute({ userId: 'user-123' });

    expect(logger.info).toHaveBeenCalledWith('User profile retrieved', { userId: 'user-123' });
  });

  it('throws UserNotFoundError when the repository returns null', async () => {
    await expect(useCase.execute({ userId: 'nonexistent-id' })).rejects.toThrow(UserNotFoundError);
  });

  it('logs error before throwing UserNotFoundError', async () => {
    await expect(useCase.execute({ userId: 'ghost-id' })).rejects.toThrow(UserNotFoundError);
    expect(logger.error).toHaveBeenCalledWith('User not found', { userId: 'ghost-id' });
  });

  it('propagates repository errors (does not swallow unexpected failures)', async () => {
    vi.spyOn(repo, 'findById').mockRejectedValue(new Error('DB connection lost'));

    await expect(useCase.execute({ userId: 'any-id' })).rejects.toThrow('DB connection lost');
  });

  it('handles user with null avatarUrl', async () => {
    const now = new Date();
    const userWithoutAvatar = User.reconstitute(
      'user-no-avatar',
      'noavatar@example.com',
      null,
      'Jane',
      'Smith',
      null,
      1,
      1,
      1,
      null,
      true,
      now,
      now,
      null,
    );
    repo.seed(userWithoutAvatar);

    const result = await useCase.execute({ userId: 'user-no-avatar' });

    expect(result.avatarUrl).toBeNull();
  });
});
