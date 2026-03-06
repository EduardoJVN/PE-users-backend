export type EmailVerificationTokenType = 'VERIFY' | 'RESET';

export class EmailVerificationToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly type: EmailVerificationTokenType,
    public readonly expiresAt: Date,
    public readonly usedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(
    id: string,
    userId: string,
    tokenHash: string,
    type: EmailVerificationTokenType,
    expiresAt: Date,
  ): EmailVerificationToken {
    const now = new Date();
    return new EmailVerificationToken(id, userId, tokenHash, type, expiresAt, null, now, now);
  }

  static reconstitute(
    id: string,
    userId: string,
    tokenHash: string,
    type: EmailVerificationTokenType,
    expiresAt: Date,
    usedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): EmailVerificationToken {
    return new EmailVerificationToken(id, userId, tokenHash, type, expiresAt, usedAt, createdAt, updatedAt);
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }
}
