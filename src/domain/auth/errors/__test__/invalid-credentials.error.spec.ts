import { describe, it, expect } from 'vitest';
import { InvalidCredentialsError } from '@domain/auth/errors/invalid-credentials.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('InvalidCredentialsError', () => {
  it('produces the correct fixed message', () => {
    const error = new InvalidCredentialsError();
    expect(error.message).toBe('Invalid email or password');
  });

  it('is an instance of DomainError', () => {
    const error = new InvalidCredentialsError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new InvalidCredentialsError();
    expect(error).toBeInstanceOf(Error);
  });
});
