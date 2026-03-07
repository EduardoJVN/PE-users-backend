import { describe, it, expect } from 'vitest';
import { User } from '@domain/user/entities/user.entity.js';
import { InvalidEmailFormatError } from '@domain/user/errors/invalid-email-format.error.js';
import { InvalidGoogleIdError } from '@domain/auth/errors/invalid-google-id.error.js';

const BASE_STATUS_ID = 1;
const ACTIVE_STATUS_ID = 2;
const BASE_ROLE_ID = 1;
const BASE_REGISTER_TYPE_ID = 1;

describe('User', () => {
  describe('create()', () => {
    it('creates a user with valid fields and isActive=false', () => {
      const before = new Date();
      const user = User.create(
        'user-1',
        'alice@example.com',
        'hash-abc',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      const after = new Date();

      expect(user.id).toBe('user-1');
      expect(user.email).toBe('alice@example.com');
      expect(user.password).toBe('hash-abc');
      expect(user.name).toBe('Alice');
      expect(user.lastName).toBe('Smith');
      expect(user.statusId).toBe(BASE_STATUS_ID);
      expect(user.roleId).toBe(BASE_ROLE_ID);
      expect(user.registerTypeId).toBe(BASE_REGISTER_TYPE_ID);
      expect(user.googleId).toBeNull();
      expect(user.isActive).toBe(false);
      expect(user.avatarUrl).toBeNull();
      expect(user.deletedAt).toBeNull();
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('sets createdAt and updatedAt to the same value on create', () => {
      const user = User.create(
        'user-1',
        'alice@example.com',
        'hash-abc',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      expect(user.createdAt.getTime()).toBe(user.updatedAt.getTime());
    });

    it('accepts null password for OAuth users', () => {
      const user = User.create(
        'user-1',
        'alice@example.com',
        null,
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      expect(user.password).toBeNull();
    });

    it('stores googleId when provided', () => {
      const user = User.create(
        'user-1',
        'alice@example.com',
        null,
        'Alice',
        'Smith',
        'google-123',
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      expect(user.googleId).toBe('google-123');
    });

    it('throws InvalidEmailFormatError for an email without @', () => {
      expect(() =>
        User.create(
          'user-1',
          'notanemail',
          'hash',
          'Alice',
          'Smith',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email without domain', () => {
      expect(() =>
        User.create(
          'user-1',
          'missing@',
          'hash',
          'Alice',
          'Smith',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email without local part', () => {
      expect(() =>
        User.create(
          'user-1',
          '@domain.com',
          'hash',
          'Alice',
          'Smith',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).toThrow(InvalidEmailFormatError);
    });

    it('throws InvalidEmailFormatError for an email with spaces', () => {
      expect(() =>
        User.create(
          'user-1',
          'a b@domain.com',
          'hash',
          'Alice',
          'Smith',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).toThrow(InvalidEmailFormatError);
    });

    it('accepts various valid email formats', () => {
      expect(() =>
        User.create(
          'u1',
          'user.name+tag@sub.domain.com',
          'h',
          'A',
          'B',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).not.toThrow();
      expect(() =>
        User.create(
          'u2',
          'simple@example.org',
          'h',
          'A',
          'B',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
        ),
      ).not.toThrow();
    });
  });

  describe('reconstitute()', () => {
    it('reconstitutes a user with the exact provided values', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-06-01T00:00:00Z');
      const deletedAt = new Date('2024-12-01T00:00:00Z');
      const user = User.reconstitute(
        'user-42',
        'bob@example.com',
        'hash-xyz',
        'Bob',
        'Jones',
        'https://example.com/avatar.png',
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        createdAt,
        updatedAt,
        deletedAt,
      );

      expect(user.id).toBe('user-42');
      expect(user.email).toBe('bob@example.com');
      expect(user.password).toBe('hash-xyz');
      expect(user.name).toBe('Bob');
      expect(user.lastName).toBe('Jones');
      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
      expect(user.statusId).toBe(BASE_STATUS_ID);
      expect(user.roleId).toBe(BASE_ROLE_ID);
      expect(user.registerTypeId).toBe(BASE_REGISTER_TYPE_ID);
      expect(user.googleId).toBeNull();
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
      expect(user.deletedAt).toBe(deletedAt);
    });

    it('reconstitutes with null optional fields', () => {
      const now = new Date();
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        null,
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        false,
        now,
        now,
        null,
      );
      expect(user.password).toBeNull();
      expect(user.avatarUrl).toBeNull();
      expect(user.googleId).toBeNull();
      expect(user.deletedAt).toBeNull();
    });

    it('reconstitutes with a googleId', () => {
      const now = new Date();
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        null,
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        'google-456',
        false,
        now,
        now,
        null,
      );
      expect(user.googleId).toBe('google-456');
    });

    it('does NOT validate email format during reconstitution', () => {
      const now = new Date();
      expect(() =>
        User.reconstitute(
          'user-1',
          'invalid-email',
          'hash',
          'Alice',
          'Smith',
          null,
          BASE_STATUS_ID,
          BASE_ROLE_ID,
          BASE_REGISTER_TYPE_ID,
          null,
          false,
          now,
          now,
          null,
        ),
      ).not.toThrow();
    });
  });

  describe('activate()', () => {
    it('returns a new User instance with isActive=true and updated statusId', () => {
      const user = User.create(
        'user-1',
        'alice@example.com',
        'hash-abc',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      expect(user.isActive).toBe(false);

      const activated = user.activate(ACTIVE_STATUS_ID);

      expect(activated.isActive).toBe(true);
      expect(activated.statusId).toBe(ACTIVE_STATUS_ID);
    });

    it('does not mutate the original user', () => {
      const user = User.create(
        'user-1',
        'alice@example.com',
        'hash-abc',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
      );
      user.activate(ACTIVE_STATUS_ID);

      expect(user.isActive).toBe(false);
      expect(user.statusId).toBe(BASE_STATUS_ID);
    });

    it('preserves all other fields when activating', () => {
      const createdAt = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        'https://avatar.url',
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        'google-789',
        false,
        createdAt,
        createdAt,
        null,
      );

      const activated = user.activate(ACTIVE_STATUS_ID);

      expect(activated.id).toBe('user-1');
      expect(activated.email).toBe('alice@example.com');
      expect(activated.password).toBe('hash');
      expect(activated.name).toBe('Alice');
      expect(activated.lastName).toBe('Smith');
      expect(activated.avatarUrl).toBe('https://avatar.url');
      expect(activated.roleId).toBe(BASE_ROLE_ID);
      expect(activated.registerTypeId).toBe(BASE_REGISTER_TYPE_ID);
      expect(activated.googleId).toBe('google-789');
      expect(activated.createdAt).toBe(createdAt);
      expect(activated.deletedAt).toBeNull();
    });
  });

  describe('linkGoogle()', () => {
    it('returns a new User with the given googleId', () => {
      const now = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        now,
        now,
        null,
      );

      const linked = user.linkGoogle('google-abc');

      expect(linked.googleId).toBe('google-abc');
    });

    it('preserves all existing fields except googleId and updatedAt', () => {
      const createdAt = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        'https://avatar.url',
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        createdAt,
        createdAt,
        null,
      );

      const linked = user.linkGoogle('google-abc');

      expect(linked.id).toBe('user-1');
      expect(linked.email).toBe('alice@example.com');
      expect(linked.password).toBe('hash');
      expect(linked.name).toBe('Alice');
      expect(linked.lastName).toBe('Smith');
      expect(linked.avatarUrl).toBe('https://avatar.url');
      expect(linked.statusId).toBe(BASE_STATUS_ID);
      expect(linked.roleId).toBe(BASE_ROLE_ID);
      expect(linked.registerTypeId).toBe(BASE_REGISTER_TYPE_ID);
      expect(linked.isActive).toBe(true);
      expect(linked.createdAt).toBe(createdAt);
      expect(linked.deletedAt).toBeNull();
    });

    it('does not mutate the original user', () => {
      const now = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        now,
        now,
        null,
      );

      user.linkGoogle('google-abc');

      expect(user.googleId).toBeNull();
    });

    it('throws InvalidGoogleIdError when googleId is an empty string', () => {
      const now = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        now,
        now,
        null,
      );

      expect(() => user.linkGoogle('')).toThrow(InvalidGoogleIdError);
    });

    it('throws InvalidGoogleIdError when googleId is whitespace-only', () => {
      const now = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        now,
        now,
        null,
      );

      expect(() => user.linkGoogle('   ')).toThrow(InvalidGoogleIdError);
    });

    it('updates updatedAt to a more recent time', () => {
      const createdAt = new Date('2024-01-01');
      const user = User.reconstitute(
        'user-1',
        'alice@example.com',
        'hash',
        'Alice',
        'Smith',
        null,
        BASE_STATUS_ID,
        BASE_ROLE_ID,
        BASE_REGISTER_TYPE_ID,
        null,
        true,
        createdAt,
        createdAt,
        null,
      );

      const before = new Date();
      const linked = user.linkGoogle('google-abc');
      const after = new Date();

      expect(linked.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(linked.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
