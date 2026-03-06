import { randomUUID, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { RateLimitExceededError } from '@domain/auth/errors/rate-limit-exceeded.error.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailSender } from '@domain/ports/email-sender.port.js';
import type { IRateLimiter } from '@domain/ports/rate-limiter.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { ForgotPasswordCommand } from '@application/auth/dto/forgot-password-auth.dto.js';

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly evtRepo: IEmailVerificationTokenRepository,
    private readonly emailSender: IEmailSender,
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: ILogger,
    private readonly resetBaseUrl: string,
    private readonly tokenTtlMs: number,
    private readonly rateLimitWindowMs: number,
    private readonly rateLimitMax: number,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<void> {
    const allowed = await this.rateLimiter.checkAndIncrement(
      command.rateLimitKey,
      this.rateLimitWindowMs,
      this.rateLimitMax,
    );

    if (!allowed) {
      throw new RateLimitExceededError(Math.ceil(this.rateLimitWindowMs / 1000));
    }

    const user = await this.userRepo.findByEmail(command.email);

    if (user === null) {
      return;
    }

    const tokenId = uuidv7();
    const plaintextToken = randomUUID();
    const tokenHash = createHash('sha256').update(plaintextToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);

    const token = EmailVerificationToken.create(tokenId, user.id, tokenHash, 'RESET', expiresAt);

    await this.evtRepo.save(token);

    await this.emailSender.sendPasswordResetEmail({
      to: user.email,
      resetUrl: `${this.resetBaseUrl}?token=${plaintextToken}`,
    });

    this.logger.info('Password reset email sent', { userId: user.id });
  }
}
