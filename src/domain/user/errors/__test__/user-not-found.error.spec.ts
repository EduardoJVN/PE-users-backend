import { describe, it, expect } from 'vitest';
import { UserNotFoundError } from '@domain/user/errors/user-not-found.error.js';
import { NotFoundError } from '@shared/errors/not-found.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('UserNotFoundError', () => {
  it('produces the correct message format', () => {
    const error = new UserNotFoundError('user-123');
    expect(error.message).toBe('User not found: user-123');
  });

  it('is an instance of NotFoundError', () => {
    const error = new UserNotFoundError('user-123');
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('is an instance of DomainError', () => {
    const error = new UserNotFoundError('user-123');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new UserNotFoundError('user-123');
    expect(error).toBeInstanceOf(Error);
  });
});
