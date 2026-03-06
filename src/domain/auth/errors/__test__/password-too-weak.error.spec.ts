import { describe, it, expect } from 'vitest';
import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('PasswordTooWeakError', () => {
  it('produces the correct fixed message', () => {
    const error = new PasswordTooWeakError();
    expect(error.message).toBe(
      'Password must be at least 8 characters and contain an uppercase letter, a number, and a special character',
    );
  });

  it('sets name to the class name', () => {
    const error = new PasswordTooWeakError();
    expect(error.name).toBe('PasswordTooWeakError');
  });

  it('is an instance of DomainError', () => {
    const error = new PasswordTooWeakError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new PasswordTooWeakError();
    expect(error).toBeInstanceOf(Error);
  });
});
