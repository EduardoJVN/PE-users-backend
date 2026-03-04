import { InvalidEmailFormatError } from '@domain/user/errors/invalid-email-format.error.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(id: string, email: string, passwordHash: string): User {
    if (!EMAIL_REGEX.test(email)) {
      throw new InvalidEmailFormatError(email);
    }
    const now = new Date();
    return new User(id, email, passwordHash, now, now);
  }

  static reconstitute(
    id: string,
    email: string,
    passwordHash: string,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(id, email, passwordHash, createdAt, updatedAt);
  }
}
