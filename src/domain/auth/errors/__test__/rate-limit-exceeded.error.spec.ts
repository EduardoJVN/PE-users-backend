import { describe, it, expect } from 'vitest';
import { RateLimitExceededError } from '@domain/auth/errors/rate-limit-exceeded.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('RateLimitExceededError', () => {
  it('produces the correct message with retryAfterSeconds', () => {
    const error = new RateLimitExceededError(60);
    expect(error.message).toBe('Rate limit exceeded. Try again in 60 seconds');
  });

  it('exposes retryAfterSeconds as a public property', () => {
    const error = new RateLimitExceededError(30);
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('sets name to the class name', () => {
    const error = new RateLimitExceededError(60);
    expect(error.name).toBe('RateLimitExceededError');
  });

  it('is an instance of DomainError', () => {
    const error = new RateLimitExceededError(60);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new RateLimitExceededError(60);
    expect(error).toBeInstanceOf(Error);
  });
});
