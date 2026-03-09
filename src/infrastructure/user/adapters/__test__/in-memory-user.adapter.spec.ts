import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryUserAdapter } from '@infra/user/adapters/in-memory-user.adapter.js';
import { User } from '@domain/user/entities/user.entity.js';

const makeUser = (id: string, email: string, googleId: string | null = null): User =>
  User.reconstitute(
    id,
    email,
    'hashed-password',
    'Test',
    'User',
    null,
    1,
    1,
    1,
    googleId,
    true,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );

describe('InMemoryUserAdapter', () => {
  let adapter: InMemoryUserAdapter;

  beforeEach(() => {
    adapter = new InMemoryUserAdapter();
  });

  describe('save', () => {
    it('saves a user and allows retrieval by id', async () => {
      const user = makeUser('u-1', 'alice@example.com');
      await adapter.save(user);

      const found = await adapter.findById('u-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('u-1');
      expect(found!.email).toBe('alice@example.com');
    });

    it('throws when saving a user with a duplicate id', async () => {
      const user = makeUser('u-1', 'alice@example.com');
      await adapter.save(user);

      const duplicate = makeUser('u-1', 'other@example.com');
      await expect(adapter.save(duplicate)).rejects.toThrow("User with id 'u-1' already exists");
    });
  });

  describe('findById', () => {
    it('returns null when user does not exist', async () => {
      const found = await adapter.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns the user matching the email', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));
      await adapter.save(makeUser('u-2', 'bob@example.com'));

      const found = await adapter.findByEmail('bob@example.com');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('u-2');
    });

    it('returns null when no user matches the email', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));

      const found = await adapter.findByEmail('nobody@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByGoogleId', () => {
    it('returns the user matching the googleId', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com', 'google-123'));
      await adapter.save(makeUser('u-2', 'bob@example.com', 'google-456'));

      const found = await adapter.findByGoogleId('google-456');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('u-2');
    });

    it('returns null when no user matches the googleId', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com', 'google-123'));

      const found = await adapter.findByGoogleId('google-999');
      expect(found).toBeNull();
    });

    it('returns null when googleId is null on all users', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));

      const found = await adapter.findByGoogleId('google-123');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns empty array when store is empty', async () => {
      const users = await adapter.findAll();
      expect(users).toHaveLength(0);
    });

    it('returns all saved users', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));
      await adapter.save(makeUser('u-2', 'bob@example.com'));

      const users = await adapter.findAll();
      expect(users).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('replaces the stored user', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));

      const updated = User.reconstitute(
        'u-1',
        'alice-new@example.com',
        'new-hash',
        'Test',
        'User',
        null,
        1,
        1,
        1,
        null,
        true,
        new Date(),
        new Date(),
        null,
      );
      await adapter.update(updated);

      const found = await adapter.findById('u-1');
      expect(found!.email).toBe('alice-new@example.com');
    });

    it('throws when updating a user that does not exist', async () => {
      const user = makeUser('u-999', 'ghost@example.com');
      await expect(adapter.update(user)).rejects.toThrow("User with id 'u-999' does not exist");
    });
  });

  describe('delete', () => {
    it('removes the user from the store', async () => {
      await adapter.save(makeUser('u-1', 'alice@example.com'));
      await adapter.delete('u-1');

      const found = await adapter.findById('u-1');
      expect(found).toBeNull();
    });

    it('does nothing when the user does not exist', async () => {
      await expect(adapter.delete('nonexistent')).resolves.not.toThrow();
    });
  });
});
