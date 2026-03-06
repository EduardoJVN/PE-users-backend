import { describe, it, expect } from 'vitest';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';

const futureDate = (): Date => new Date(Date.now() + 60_000);
const pastDate = (): Date => new Date(Date.now() - 10_000);

describe('EmailVerificationToken', () => {
  describe('create()', () => {
    it('sets usedAt to null on creation', () => {
      const token = EmailVerificationToken.create(
        'evt-1',
        'user-1',
        'hash-abc',
        'VERIFY',
        futureDate(),
      );
      expect(token.usedAt).toBeNull();
    });

    it('stores all fields correctly', () => {
      const expires = futureDate();
      const before = new Date();
      const token = EmailVerificationToken.create('evt-1', 'user-1', 'hash-abc', 'VERIFY', expires);
      const after = new Date();

      expect(token.id).toBe('evt-1');
      expect(token.userId).toBe('user-1');
      expect(token.tokenHash).toBe('hash-abc');
      expect(token.type).toBe('VERIFY');
      expect(token.expiresAt).toBe(expires);
      expect(token.usedAt).toBeNull();
      expect(token.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(token.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(token.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(token.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('supports RESET type', () => {
      const token = EmailVerificationToken.create(
        'evt-2',
        'user-2',
        'hash-xyz',
        'RESET',
        futureDate(),
      );
      expect(token.type).toBe('RESET');
    });
  });

  describe('reconstitute()', () => {
    it('stores all fields exactly as provided', () => {
      const expiresAt = futureDate();
      const usedAt = new Date('2024-06-15');
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-06-15');

      const token = EmailVerificationToken.reconstitute(
        'evt-99',
        'user-99',
        'hash-reconstituted',
        'RESET',
        expiresAt,
        usedAt,
        createdAt,
        updatedAt,
      );

      expect(token.id).toBe('evt-99');
      expect(token.userId).toBe('user-99');
      expect(token.tokenHash).toBe('hash-reconstituted');
      expect(token.type).toBe('RESET');
      expect(token.expiresAt).toBe(expiresAt);
      expect(token.usedAt).toBe(usedAt);
      expect(token.createdAt).toBe(createdAt);
      expect(token.updatedAt).toBe(updatedAt);
    });

    it('reconstitutes with null usedAt', () => {
      const token = EmailVerificationToken.reconstitute(
        'evt-1',
        'user-1',
        'hash',
        'VERIFY',
        futureDate(),
        null,
        new Date(),
        new Date(),
      );
      expect(token.usedAt).toBeNull();
    });
  });

  describe('isExpired()', () => {
    it('returns true when expiresAt is in the past', () => {
      const token = EmailVerificationToken.reconstitute(
        'evt-1',
        'user-1',
        'hash',
        'VERIFY',
        pastDate(),
        null,
        new Date(),
        new Date(),
      );
      expect(token.isExpired()).toBe(true);
    });

    it('returns false when expiresAt is in the future', () => {
      const token = EmailVerificationToken.create(
        'evt-1',
        'user-1',
        'hash',
        'VERIFY',
        futureDate(),
      );
      expect(token.isExpired()).toBe(false);
    });
  });

  describe('isUsed()', () => {
    it('returns true when usedAt is set', () => {
      const token = EmailVerificationToken.reconstitute(
        'evt-1',
        'user-1',
        'hash',
        'VERIFY',
        futureDate(),
        new Date(),
        new Date(),
        new Date(),
      );
      expect(token.isUsed()).toBe(true);
    });

    it('returns false when usedAt is null', () => {
      const token = EmailVerificationToken.create(
        'evt-1',
        'user-1',
        'hash',
        'VERIFY',
        futureDate(),
      );
      expect(token.isUsed()).toBe(false);
    });
  });
});
