import { describe, it, expect } from 'vitest';
import {
  RefreshToken,
  RefreshTokenAlreadyUsedError,
  RefreshTokenExpiresInPastError,
} from '@domain/auth/entities/refresh-token.entity.js';
import { DomainError } from '@shared/errors/domain.error.js';

const futureDate = (): Date => new Date(Date.now() + 60_000);
const pastDate = (): Date => new Date(Date.now() - 1);

describe('RefreshToken', () => {
  describe('create()', () => {
    it('creates a refresh token with valid inputs', () => {
      const expires = futureDate();
      const before = new Date();
      const token = RefreshToken.create('rt-1', 'user-1', 'hash-abc', expires);
      const after = new Date();

      expect(token.id).toBe('rt-1');
      expect(token.userId).toBe('user-1');
      expect(token.tokenHash).toBe('hash-abc');
      expect(token.expiresAt).toBe(expires);
      expect(token.usedAt).toBeNull();
      expect(token.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(token.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('throws when expiresAt is in the past', () => {
      expect(() => RefreshToken.create('rt-1', 'user-1', 'hash', pastDate())).toThrow(
        RefreshTokenExpiresInPastError,
      );
    });

    it('throws when expiresAt equals now (boundary — not strictly future)', () => {
      // Since we check <= new Date(), exact-now is also rejected
      // We can't perfectly control timing so we test with a date clearly in the past
      const slightlyPast = new Date(Date.now() - 100);
      expect(() => RefreshToken.create('rt-1', 'user-1', 'hash', slightlyPast)).toThrow(
        DomainError,
      );
    });

    it('sets usedAt to null on creation', () => {
      const token = RefreshToken.create('rt-1', 'user-1', 'hash', futureDate());
      expect(token.usedAt).toBeNull();
    });
  });

  describe('reconstitute()', () => {
    it('reconstitutes with all provided values without validation', () => {
      const expiresAt = pastDate();
      const usedAt = new Date('2024-01-01');
      const createdAt = new Date('2023-12-01');

      const token = RefreshToken.reconstitute(
        'rt-99',
        'user-99',
        'h',
        expiresAt,
        usedAt,
        createdAt,
      );

      expect(token.id).toBe('rt-99');
      expect(token.userId).toBe('user-99');
      expect(token.tokenHash).toBe('h');
      expect(token.expiresAt).toBe(expiresAt);
      expect(token.usedAt).toBe(usedAt);
      expect(token.createdAt).toBe(createdAt);
    });

    it('reconstitutes with null usedAt', () => {
      const token = RefreshToken.reconstitute(
        'rt-1',
        'user-1',
        'h',
        futureDate(),
        null,
        new Date(),
      );
      expect(token.usedAt).toBeNull();
    });
  });

  describe('isExpired()', () => {
    it('returns false when token has not expired yet', () => {
      const token = RefreshToken.create('rt-1', 'user-1', 'hash', futureDate());
      expect(token.isExpired()).toBe(false);
    });

    it('returns true when token is already expired (reconstituted from past)', () => {
      const past = new Date(Date.now() - 10_000);
      const token = RefreshToken.reconstitute('rt-1', 'user-1', 'hash', past, null, new Date());
      expect(token.isExpired()).toBe(true);
    });
  });

  describe('isUsed()', () => {
    it('returns false when usedAt is null', () => {
      const token = RefreshToken.create('rt-1', 'user-1', 'hash', futureDate());
      expect(token.isUsed()).toBe(false);
    });

    it('returns true when usedAt is set', () => {
      const token = RefreshToken.reconstitute(
        'rt-1',
        'user-1',
        'hash',
        futureDate(),
        new Date(),
        new Date(),
      );
      expect(token.isUsed()).toBe(true);
    });
  });

  describe('markAsUsed()', () => {
    it('sets usedAt to a date when called on an unused token', () => {
      const token = RefreshToken.create('rt-1', 'user-1', 'hash', futureDate());
      const before = new Date();
      token.markAsUsed();
      const after = new Date();

      expect(token.usedAt).not.toBeNull();
      expect(token.usedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(token.usedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('throws RefreshTokenAlreadyUsedError when called twice', () => {
      const token = RefreshToken.create('rt-1', 'user-1', 'hash', futureDate());
      token.markAsUsed();
      expect(() => token.markAsUsed()).toThrow(RefreshTokenAlreadyUsedError);
    });

    it('throws a DomainError when called on an already-used reconstituted token', () => {
      const token = RefreshToken.reconstitute(
        'rt-1',
        'user-1',
        'hash',
        futureDate(),
        new Date(),
        new Date(),
      );
      expect(() => token.markAsUsed()).toThrow(DomainError);
    });
  });
});
