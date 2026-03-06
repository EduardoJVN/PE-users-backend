import { describe, it, expect } from 'vitest';
import { EmailVerificationTokenExpiredError } from '@domain/auth/errors/email-verification-token-expired.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('EmailVerificationTokenExpiredError', () => {
  it('produces the correct fixed message', () => {
    const error = new EmailVerificationTokenExpiredError();
    expect(error.message).toBe('Email verification token has expired');
  });

  it('sets name to the class name', () => {
    const error = new EmailVerificationTokenExpiredError();
    expect(error.name).toBe('EmailVerificationTokenExpiredError');
  });

  it('is an instance of DomainError', () => {
    const error = new EmailVerificationTokenExpiredError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new EmailVerificationTokenExpiredError();
    expect(error).toBeInstanceOf(Error);
  });
});
