import { describe, it, expect } from 'vitest';
import { UserNotVerifiedError } from '@domain/auth/errors/user-not-verified.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('UserNotVerifiedError', () => {
  it('produces the correct fixed message', () => {
    const error = new UserNotVerifiedError();
    expect(error.message).toBe(
      'User email is not verified. Please verify your email before logging in',
    );
  });

  it('sets name to the class name', () => {
    const error = new UserNotVerifiedError();
    expect(error.name).toBe('UserNotVerifiedError');
  });

  it('is an instance of DomainError', () => {
    const error = new UserNotVerifiedError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new UserNotVerifiedError();
    expect(error).toBeInstanceOf(Error);
  });
});
