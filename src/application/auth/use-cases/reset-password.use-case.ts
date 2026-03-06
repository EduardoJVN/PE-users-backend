import { createHash } from 'node:crypto';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationTokenExpiredError } from '@domain/auth/errors/email-verification-token-expired.error.js';
import { EmailVerificationTokenInvalidError } from '@domain/auth/errors/email-verification-token-invalid.error.js';
import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { ResetPasswordCommand, ResetPasswordResult } from '@application/auth/dto/reset-password-auth.dto.js';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly evtRepo: IEmailVerificationTokenRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    if (!PASSWORD_REGEX.test(command.newPassword)) {
      throw new PasswordTooWeakError();
    }

    const tokenHash = createHash('sha256').update(command.token).digest('hex');
    const token = await this.evtRepo.findByTokenHash(tokenHash);

    if (token === null) {
      throw new EmailVerificationTokenInvalidError();
    }

    if (token.type !== 'RESET') {
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

    const newPasswordHash = await this.passwordHasher.hash(command.newPassword);

    const updated = User.reconstitute(
      user.id,
      user.email,
      newPasswordHash,
      user.name,
      user.lastName,
      user.avatarUrl,
      user.statusId,
      user.roleId,
      user.registerTypeId,
      user.isActive,
      user.createdAt,
      new Date(),
      user.deletedAt,
    );

    await this.userRepo.update(updated);
    await this.evtRepo.delete(token.userId);

    this.logger.info('Password reset', { userId: user.id });

    return { message: 'Password reset successfully' };
  }
}
