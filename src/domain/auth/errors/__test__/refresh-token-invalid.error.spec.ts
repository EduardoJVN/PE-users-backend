import { describe, it, expect } from 'vitest';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('RefreshTokenInvalidError', () => {
  it('produces the correct fixed message', () => {
    const error = new RefreshTokenInvalidError();
    expect(error.message).toBe('Refresh token is invalid');
  });

  it('is an instance of DomainError', () => {
    const error = new RefreshTokenInvalidError();
    expect(error).toBeInstanceOf(DomainError);
  });
});
