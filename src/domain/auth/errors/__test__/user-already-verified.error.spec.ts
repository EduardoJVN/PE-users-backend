import { describe, it, expect } from 'vitest';
import { UserAlreadyVerifiedError } from '@domain/auth/errors/user-already-verified.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('UserAlreadyVerifiedError', () => {
  it('produces the correct fixed message', () => {
    const error = new UserAlreadyVerifiedError();
    expect(error.message).toBe('User email is already verified');
  });

  it('sets name to the class name', () => {
    const error = new UserAlreadyVerifiedError();
    expect(error.name).toBe('UserAlreadyVerifiedError');
  });

  it('is an instance of DomainError', () => {
    const error = new UserAlreadyVerifiedError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new UserAlreadyVerifiedError();
    expect(error).toBeInstanceOf(Error);
  });
});
