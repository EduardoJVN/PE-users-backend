import { randomUUID, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { InvalidCredentialsError } from '@domain/auth/errors/invalid-credentials.error.js';
import { UserNotVerifiedError } from '@domain/auth/errors/user-not-verified.error.js';
import { UserStatusId } from '@domain/catalog-ids.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { ITokenSigner } from '@domain/auth/ports/token-signer.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { LoginCommand, LoginResult } from '@application/auth/dto/login-auth.dto.js';

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenSigner: ITokenSigner,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
    private readonly refreshTokenTtlDays: number,
    private readonly dummyHash: string,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(command.email);

    if (user === null) {
      // Timing attack prevention: always run a bcrypt compare even for unknown users
      await this.passwordHasher.compare(command.password, this.dummyHash);
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      command.password,
      user.password ?? this.dummyHash,
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    if (user.statusId === UserStatusId.PENDING) {
      throw new UserNotVerifiedError();
    }

    const tokenId = uuidv7();
    const plaintextToken = randomUUID();
    const tokenHash = createHash('sha256').update(plaintextToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    const refreshToken = RefreshToken.create(tokenId, user.id, tokenHash, expiresAt);
    await this.refreshTokenRepository.save(refreshToken);

    const accessToken = this.tokenSigner.sign({ sub: user.id, email: user.email }, '15m');

    this.logger.info('User logged in', { userId: user.id });

    return { accessToken, refreshToken: plaintextToken };
  }
}
