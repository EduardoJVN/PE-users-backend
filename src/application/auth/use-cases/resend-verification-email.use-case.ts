import { createHash, randomUUID } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { UserAlreadyVerifiedError } from '@domain/auth/errors/user-already-verified.error.js';
import { RateLimitExceededError } from '@domain/auth/errors/rate-limit-exceeded.error.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailSender } from '@domain/ports/email-sender.port.js';
import type { IRateLimiter } from '@domain/ports/rate-limiter.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { ResendVerificationCommand, ResendVerificationResult } from '@application/auth/dto/resend-verification-auth.dto.js';

const SILENT_MESSAGE = 'If your account exists, a verification email has been sent';

export class ResendVerificationEmailUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly evtRepo: IEmailVerificationTokenRepository,
    private readonly emailSender: IEmailSender,
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: ILogger,
    private readonly verificationBaseUrl: string,
    private readonly tokenTtlMs: number,
    private readonly rateLimitWindowMs: number,
    private readonly rateLimitMax: number,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<ResendVerificationResult> {
    const user = await this.userRepo.findById(command.userId);
    if (user === null) {
      return { message: SILENT_MESSAGE };
    }

    if (user.isActive === true) {
      throw new UserAlreadyVerifiedError();
    }

    const allowed = await this.rateLimiter.checkAndIncrement(
      command.rateLimitKey,
      this.rateLimitWindowMs,
      this.rateLimitMax,
    );
    if (!allowed) {
      throw new RateLimitExceededError(Math.ceil(this.rateLimitWindowMs / 1000));
    }

    const tokenId = uuidv7();
    const plaintextToken = randomUUID();
    const tokenHash = createHash('sha256').update(plaintextToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);
    const token = EmailVerificationToken.create(tokenId, command.userId, tokenHash, 'VERIFY', expiresAt);

    await this.evtRepo.save(token);

    await this.emailSender.sendVerificationEmail({
      to: user.email,
      verificationUrl: `${this.verificationBaseUrl}?token=${plaintextToken}`,
    });

    this.logger.info('Verification email resent', { userId: command.userId });

    return { message: SILENT_MESSAGE };
  }
}
