import { randomUUID, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { EmailAlreadyExistsError } from '@domain/auth/errors/email-already-exists.error.js';
import { Password } from '@domain/auth/value-objects/password.value-object.js';
import { UserStatusId, UserRoleId, RegisterTypeId } from '@domain/catalog-ids.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { IEmailSender } from '@domain/ports/email-sender.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type {
  RegisterUserCommand,
  RegisterUserResult,
} from '@application/auth/dto/register-user-auth.dto.js';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly evtRepo: IEmailVerificationTokenRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly emailSender: IEmailSender,
    private readonly logger: ILogger,
    private readonly verificationBaseUrl: string,
    private readonly tokenTtlMs: number,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    const existing = await this.userRepo.findByEmail(command.email);
    if (existing !== null) {
      throw new EmailAlreadyExistsError(command.email);
    }

    const password = Password.create(command.password);
    const passwordHash = await this.passwordHasher.hash(password.value);

    const userId = uuidv7();
    const user = User.create(
      userId,
      command.email,
      passwordHash,
      command.name,
      command.lastName,
      null,
      UserStatusId.PENDING,
      UserRoleId.USER,
      RegisterTypeId.EMAIL,
    );

    await this.userRepo.save(user);

    const tokenId = uuidv7();
    const plaintextToken = randomUUID();
    // para poder ver el token generado de validacion para uso local
    // console.log('Plaintext token:', plaintextToken); // Debug log to check the generated token
    const tokenHash = createHash('sha256').update(plaintextToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);

    const token = EmailVerificationToken.create(tokenId, userId, tokenHash, 'VERIFY', expiresAt);
    await this.evtRepo.save(token);

    await this.emailSender.sendVerificationEmail({
      to: command.email,
      verificationUrl: `${this.verificationBaseUrl}?token=${plaintextToken}`,
    });

    this.logger.info('User registered', { userId });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
    };
  }
}
