import { createHash } from 'node:crypto';
import { EmailVerificationTokenExpiredError } from '@domain/auth/errors/email-verification-token-expired.error.js';
import { EmailVerificationTokenInvalidError } from '@domain/auth/errors/email-verification-token-invalid.error.js';
import { UserAlreadyVerifiedError } from '@domain/auth/errors/user-already-verified.error.js';
import { UserStatusId } from '@domain/catalog-ids.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type {
  VerifyEmailCommand,
  VerifyEmailResult,
} from '@application/auth/dto/verify-email-auth.dto.js';

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly evtRepo: IEmailVerificationTokenRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    const tokenHash = createHash('sha256').update(command.token).digest('hex');
    const token = await this.evtRepo.findByTokenHash(tokenHash);
    if (token === null) {
      throw new EmailVerificationTokenInvalidError();
    }

    if (token.type !== 'VERIFY') {
      throw new EmailVerificationTokenInvalidError();
    }

    if (token.isExpired()) {
      throw new EmailVerificationTokenExpiredError();
    }

    if (token.isUsed()) {
      throw new EmailVerificationTokenInvalidError();
    }

    const user = await this.userRepo.findById(token.userId);
    if (user === null) {
      throw new EmailVerificationTokenInvalidError();
    }

    if (user.isActive === true) {
      throw new UserAlreadyVerifiedError();
    }

    const activated = user.activate(UserStatusId.ACTIVE);
    await this.userRepo.update(activated);
    await this.evtRepo.delete(token.userId);

    this.logger.info('Email verified', { userId: user.id });

    return { message: 'Email verified successfully' };
  }
}
