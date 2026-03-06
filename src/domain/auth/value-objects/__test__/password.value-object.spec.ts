import { describe, it, expect } from 'vitest';
import { Password } from '@domain/auth/value-objects/password.value-object.js';
import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';

describe('Password', () => {
  describe('create()', () => {
    it('returns a Password instance for a valid password', () => {
      const password = Password.create('ValidPass1!');
      expect(password.value).toBe('ValidPass1!');
    });

    it('throws PasswordTooWeakError when shorter than 8 characters', () => {
      expect(() => Password.create('Va1!')).toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when missing uppercase letter', () => {
      expect(() => Password.create('validpass1!')).toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when missing number', () => {
      expect(() => Password.create('ValidPass!')).toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError when missing special character', () => {
      expect(() => Password.create('ValidPass1')).toThrow(PasswordTooWeakError);
    });

    it('throws PasswordTooWeakError for empty string', () => {
      expect(() => Password.create('')).toThrow(PasswordTooWeakError);
    });
  });
});
