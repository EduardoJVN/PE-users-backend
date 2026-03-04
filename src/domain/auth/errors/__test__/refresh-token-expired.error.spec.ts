import { describe, it, expect } from 'vitest';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('RefreshTokenExpiredError', () => {
  it('produces the correct fixed message', () => {
    const error = new RefreshTokenExpiredError();
    expect(error.message).toBe('Refresh token has expired');
  });

  it('is an instance of DomainError', () => {
    const error = new RefreshTokenExpiredError();
    expect(error).toBeInstanceOf(DomainError);
  });
});
