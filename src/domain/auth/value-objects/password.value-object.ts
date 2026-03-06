import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

export class Password {
  private constructor(public readonly value: string) {}

  static create(plaintext: string): Password {
    if (!PASSWORD_REGEX.test(plaintext)) {
      throw new PasswordTooWeakError();
    }
    return new Password(plaintext);
  }
}
