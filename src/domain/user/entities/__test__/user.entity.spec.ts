import { describe, it, expect } from 'vitest';
import { User } from '@domain/user/entities/user.entity.js';
import { InvalidEmailFormatError } from '@domain/user/errors/invalid-email-format.error.js';

describe('User', () => {
  describe('create()', () => {
    it('creates a user with valid fields', () => {
      const before = new Date();
      const user = User.create('user-1', 'alice@example.com', 'hash-abc');
      const after = new Date();

      expect(user.id).toBe('user-1');
      expect(user.email).toBe('alice@example.com');
      expect(user.passwordHash).toBe('hash-abc');
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('sets createdAt and updatedAt to the same value on create', () => {
      const user = User.create('user-1', 'alice@example.com', 'hash-abc');
      expect(user.createdAt.getTime()).toBe(user.updatedAt.getTime());
    });

    it('throws InvalidEmailFormatError for an email without @', () => {
      expect(() => User.create('user-1', 'notanemail', 'hash')).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email without domain', () => {
      expect(() => User.create('user-1', 'missing@', 'hash')).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email without local part', () => {
      expect(() => User.create('user-1', '@domain.com', 'hash')).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email with spaces', () => {
      expect(() => User.create('user-1', 'a b@domain.com', 'hash')).toThrow(
        InvalidEmailFormatError,
      );
    });

    it('accepts various valid email formats', () => {
      expect(() => User.create('u1', 'user.name+tag@sub.domain.com', 'h')).not.toThrow();
      expect(() => User.create('u2', 'simple@example.org', 'h')).not.toThrow();
    });
  });

  describe('reconstitute()', () => {
    it('reconstitutes a user with the exact provided values', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-06-01T00:00:00Z');
      const user = User.reconstitute('user-42', 'bob@example.com', 'hash-xyz', createdAt, updatedAt);

      expect(user.id).toBe('user-42');
      expect(user.email).toBe('bob@example.com');
      expect(user.passwordHash).toBe('hash-xyz');
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
    });

    it('does NOT validate email format during reconstitution', () => {
      const createdAt = new Date();
      const updatedAt = new Date();
      expect(() =>
        User.reconstitute('user-1', 'invalid-email', 'hash', createdAt, updatedAt),
      ).not.toThrow();
    });
  });
});
