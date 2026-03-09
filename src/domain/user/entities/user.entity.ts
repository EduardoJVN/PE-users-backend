import { InvalidEmailFormatError } from '@domain/user/errors/invalid-email-format.error.js';
import { InvalidGoogleIdError } from '@domain/auth/errors/invalid-google-id.error.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password: string | null,
    public readonly name: string,
    public readonly lastName: string,
    public readonly avatarUrl: string | null,
    public readonly statusId: number,
    public readonly roleId: number,
    public readonly registerTypeId: number,
    public readonly googleId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  static create(
    id: string,
    email: string,
    password: string | null,
    name: string,
    lastName: string,
    googleId: string | null,
    statusId: number,
    roleId: number,
    registerTypeId: number,
  ): User {
    if (!EMAIL_REGEX.test(email)) {
      throw new InvalidEmailFormatError(email);
    }
    const now = new Date();
    return new User(
      id,
      email,
      password,
      name,
      lastName,
      null,
      statusId,
      roleId,
      registerTypeId,
      googleId,
      false,
      now,
      now,
      null,
    );
  }

  static reconstitute(
    id: string,
    email: string,
    password: string | null,
    name: string,
    lastName: string,
    avatarUrl: string | null,
    statusId: number,
    roleId: number,
    registerTypeId: number,
    googleId: string | null,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date | null,
  ): User {
    return new User(
      id,
      email,
      password,
      name,
      lastName,
      avatarUrl,
      statusId,
      roleId,
      registerTypeId,
      googleId,
      isActive,
      createdAt,
      updatedAt,
      deletedAt,
    );
  }

  activate(activeStatusId: number): User {
    return new User(
      this.id,
      this.email,
      this.password,
      this.name,
      this.lastName,
      this.avatarUrl,
      activeStatusId,
      this.roleId,
      this.registerTypeId,
      this.googleId,
      true,
      this.createdAt,
      new Date(),
      this.deletedAt,
    );
  }

  linkGoogle(googleId: string): User {
    if (googleId.trim() === '') {
      throw new InvalidGoogleIdError();
    }
    return new User(
      this.id,
      this.email,
      this.password,
      this.name,
      this.lastName,
      this.avatarUrl,
      this.statusId,
      this.roleId,
      this.registerTypeId,
      googleId,
      this.isActive,
      this.createdAt,
      new Date(),
      this.deletedAt,
    );
  }
}
