import { describe, it, expect } from 'vitest';
import { InvalidEmailFormatError } from '@domain/user/errors/invalid-email-format.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('InvalidEmailFormatError', () => {
  it('produces the correct message format', () => {
    const error = new InvalidEmailFormatError('not-an-email');
    expect(error.message).toBe('Invalid email format: not-an-email');
  });

  it('is an instance of DomainError', () => {
    const error = new InvalidEmailFormatError('bad@');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new InvalidEmailFormatError('bad@');
    expect(error).toBeInstanceOf(Error);
  });
});
