import { DomainError } from '@shared/errors/domain.error.js';

export class RefreshTokenAlreadyRevokedError extends DomainError {
  constructor() {
    super('Refresh token has already been revoked');
  }
}

export class RefreshTokenExpiresInPastError extends DomainError {
  constructor() {
    super('Refresh token expiration date must be in the future');
  }
}

export class RefreshToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static create(id: string, userId: string, tokenHash: string, expiresAt: Date): RefreshToken {
    if (expiresAt <= new Date()) {
      throw new RefreshTokenExpiresInPastError();
    }
    const now = new Date();
    return new RefreshToken(id, userId, tokenHash, expiresAt, null, now);
  }

  static reconstitute(
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    revokedAt: Date | null,
    createdAt: Date,
  ): RefreshToken {
    return new RefreshToken(id, userId, tokenHash, expiresAt, revokedAt, createdAt);
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  revoke(): void {
    if (this.revokedAt !== null) {
      throw new RefreshTokenAlreadyRevokedError();
    }
    this.revokedAt = new Date();
  }
}
