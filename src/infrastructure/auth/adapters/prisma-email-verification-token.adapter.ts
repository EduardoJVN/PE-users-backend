import type { PrismaClient } from '@prisma/client';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import type { EmailVerificationTokenType } from '@domain/auth/entities/email-verification-token.entity.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';

export class PrismaEmailVerificationTokenAdapter implements IEmailVerificationTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    const row = await this.db.emailVerificationToken.findFirst({ where: { tokenHash } });
    return row ? toEntity(row) : null;
  }

  async save(entity: EmailVerificationToken): Promise<void> {
    await this.db.$transaction([
      this.db.emailVerificationToken.deleteMany({ where: { userId: entity.userId } }),
      this.db.emailVerificationToken.create({
        data: {
          id: entity.id,
          userId: entity.userId,
          tokenHash: entity.tokenHash,
          type: entity.type,
          expiresAt: entity.expiresAt,
          usedAt: entity.usedAt,
        },
      }),
    ]);
  }

  async delete(userId: string): Promise<void> {
    await this.db.emailVerificationToken.deleteMany({ where: { userId } });
  }
}

function toEntity(row: {
  id: string;
  userId: string;
  tokenHash: string;
  type: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailVerificationToken {
  return EmailVerificationToken.reconstitute(
    row.id,
    row.userId,
    row.tokenHash,
    row.type as EmailVerificationTokenType,
    row.expiresAt,
    row.usedAt,
    row.createdAt,
    row.updatedAt,
  );
}
