import { describe, it, expect } from 'vitest';
import { EmailAlreadyExistsError } from '@domain/auth/errors/email-already-exists.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('EmailAlreadyExistsError', () => {
  it('produces the correct message with the email', () => {
    const error = new EmailAlreadyExistsError('test@example.com');
    expect(error.message).toBe('Email already registered: test@example.com');
  });

  it('sets name to the class name', () => {
    const error = new EmailAlreadyExistsError('test@example.com');
    expect(error.name).toBe('EmailAlreadyExistsError');
  });

  it('is an instance of DomainError', () => {
    const error = new EmailAlreadyExistsError('test@example.com');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new EmailAlreadyExistsError('test@example.com');
    expect(error).toBeInstanceOf(Error);
  });
});
