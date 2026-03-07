import { describe, it, expect } from 'vitest';
import { InvalidGoogleIdError } from '../invalid-google-id.error.js';
import { DomainError } from '@shared/errors/domain.error.js';

describe('InvalidGoogleIdError', () => {
  it('has the correct message', () => {
    const error = new InvalidGoogleIdError();
    expect(error.message).toBe('Google ID cannot be empty');
  });

  it('is an instance of DomainError', () => {
    const error = new InvalidGoogleIdError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    const error = new InvalidGoogleIdError();
    expect(error).toBeInstanceOf(Error);
  });

  it('has name set to InvalidGoogleIdError', () => {
    const error = new InvalidGoogleIdError();
    expect(error.name).toBe('InvalidGoogleIdError');
  });
});
