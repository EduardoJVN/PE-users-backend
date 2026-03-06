import { describe, it, expect } from 'vitest';
import { EmailVerificationTokenInvalidError } from '@domain/auth/errors/email-verification-token-invalid.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('EmailVerificationTokenInvalidError', () => {
  it('produces the correct fixed message', () => {
    const error = new EmailVerificationTokenInvalidError();
    expect(error.message).toBe('Email verification token is invalid');
  });

  it('sets name to the class name', () => {
    const error = new EmailVerificationTokenInvalidError();
    expect(error.name).toBe('EmailVerificationTokenInvalidError');
  });

  it('is an instance of DomainError', () => {
    const error = new EmailVerificationTokenInvalidError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new EmailVerificationTokenInvalidError();
    expect(error).toBeInstanceOf(Error);
  });
});
