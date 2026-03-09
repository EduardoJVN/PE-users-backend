import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRefreshTokenAdapter } from '@infra/auth/adapters/in-memory-refresh-token.adapter.js';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';

const futureDate = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
};

const makeToken = (id: string, userId: string): RefreshToken =>
  RefreshToken.reconstitute(id, userId, 'hashed-token', futureDate(), null, new Date());

describe('InMemoryRefreshTokenAdapter', () => {
  let adapter: InMemoryRefreshTokenAdapter;

  beforeEach(() => {
    adapter = new InMemoryRefreshTokenAdapter();
  });

  describe('save', () => {
    it('saves a token and allows retrieval by id', async () => {
      const token = makeToken('t-1', 'u-1');
      await adapter.save(token);

      const found = await adapter.findById('t-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('t-1');
      expect(found!.userId).toBe('u-1');
    });

    it('throws when saving a token with a duplicate id', async () => {
      const token = makeToken('t-1', 'u-1');
      await adapter.save(token);

      const duplicate = makeToken('t-1', 'u-2');
      await expect(adapter.save(duplicate)).rejects.toThrow(
        "RefreshToken with id 't-1' already exists",
      );
    });
  });

  describe('findById', () => {
    it('returns null when token does not exist', async () => {
      const found = await adapter.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByTokenHash', () => {
    it('returns the token matching the hash', async () => {
      const token = makeToken('t-1', 'u-1');
      await adapter.save(token);

      const found = await adapter.findByTokenHash('hashed-token');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('t-1');
    });

    it('returns null when no token matches the hash', async () => {
      const found = await adapter.findByTokenHash('nonexistent-hash');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('returns all tokens for a given user', async () => {
      await adapter.save(makeToken('t-1', 'u-1'));
      await adapter.save(makeToken('t-2', 'u-1'));
      await adapter.save(makeToken('t-3', 'u-2'));

      const tokens = await adapter.findByUserId('u-1');
      expect(tokens).toHaveLength(2);
      expect(tokens.every((t) => t.userId === 'u-1')).toBe(true);
    });

    it('returns empty array when user has no tokens', async () => {
      const tokens = await adapter.findByUserId('u-999');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('returns empty array when store is empty', async () => {
      const tokens = await adapter.findAll();
      expect(tokens).toHaveLength(0);
    });

    it('returns all saved tokens', async () => {
      await adapter.save(makeToken('t-1', 'u-1'));
      await adapter.save(makeToken('t-2', 'u-2'));

      const tokens = await adapter.findAll();
      expect(tokens).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('replaces the stored token', async () => {
      const original = makeToken('t-1', 'u-1');
      await adapter.save(original);

      const updated = RefreshToken.reconstitute(
        't-1',
        'u-1',
        'new-hash',
        futureDate(),
        new Date(),
        new Date(),
      );
      await adapter.update(updated);

      const found = await adapter.findById('t-1');
      expect(found!.tokenHash).toBe('new-hash');
    });

    it('throws when updating a token that does not exist', async () => {
      const token = makeToken('t-999', 'u-1');
      await expect(adapter.update(token)).rejects.toThrow(
        "RefreshToken with id 't-999' does not exist",
      );
    });
  });

  describe('delete', () => {
    it('removes the token from the store', async () => {
      await adapter.save(makeToken('t-1', 'u-1'));
      await adapter.delete('t-1');

      const found = await adapter.findById('t-1');
      expect(found).toBeNull();
    });

    it('does nothing when the token does not exist', async () => {
      await expect(adapter.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('deleteByUserId', () => {
    it('deletes all tokens for the given user and leaves others untouched', async () => {
      await adapter.save(makeToken('t-1', 'u-1'));
      await adapter.save(makeToken('t-2', 'u-1'));
      await adapter.save(makeToken('t-3', 'u-2'));

      await adapter.deleteByUserId('u-1');

      const remaining = await adapter.findAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userId).toBe('u-2');
    });

    it('does nothing when user has no tokens', async () => {
      await adapter.save(makeToken('t-1', 'u-2'));
      await adapter.deleteByUserId('u-999');

      const remaining = await adapter.findAll();
      expect(remaining).toHaveLength(1);
    });
  });
});
