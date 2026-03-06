import type { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';

export interface IEmailVerificationTokenRepository {
  findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null>;
  save(entity: EmailVerificationToken): Promise<void>; // delete+insert in $transaction
  delete(userId: string): Promise<void>;
}
