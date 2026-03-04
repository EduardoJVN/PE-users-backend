import { randomUUID } from 'node:crypto';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { ITokenSigner } from '@domain/auth/ports/token-signer.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { RefreshTokenCommand, RefreshTokenResult } from '@application/auth/dto/refresh-token-auth.dto.js';

const REFRESH_TOKEN_TTL_DAYS = 30;

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly tokenSigner: ITokenSigner,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const existingToken = await this.refreshTokenRepository.findById(command.refreshToken);

    if (existingToken === null) {
      throw new RefreshTokenInvalidError();
    }

    if (existingToken.isExpired()) {
      throw new RefreshTokenExpiredError();
    }

    if (existingToken.isUsed()) {
      // Stolen token detected — revoke the entire user session
      await this.refreshTokenRepository.deleteByUserId(existingToken.userId);
      throw new RefreshTokenInvalidError();
    }

    // Mark old token as used and persist
    existingToken.markAsUsed();
    await this.refreshTokenRepository.update(existingToken);

    // Load user to get email for JWT payload
    const user = await this.userRepository.findById(existingToken.userId);
    if (user === null) {
      throw new RefreshTokenInvalidError();
    }

    // Issue new refresh token
    const newPlaintextToken = randomUUID();
    const newHashedToken = await this.passwordHasher.hash(newPlaintextToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const newRefreshToken = RefreshToken.create(newPlaintextToken, existingToken.userId, newHashedToken, expiresAt);
    await this.refreshTokenRepository.save(newRefreshToken);

    const accessToken = this.tokenSigner.sign({ sub: user.id, email: user.email }, '15m');

    this.logger.info('Token refreshed', { userId: user.id });

    return { accessToken, refreshToken: newPlaintextToken };
  }
}
