import { randomUUID, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenSigner } from '@domain/auth/ports/token-signer.port.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type {
  RefreshTokenCommand,
  RefreshTokenResult,
} from '@application/auth/dto/refresh-token-auth.dto.js';

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly tokenSigner: ITokenSigner,
    private readonly logger: ILogger,
    private readonly refreshTokenTtlDays: number,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const incomingHash = createHash('sha256').update(command.refreshToken).digest('hex');
    const existingToken = await this.refreshTokenRepository.findByTokenHash(incomingHash);

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
    const newTokenId = uuidv7();
    const newPlaintextToken = randomUUID();
    const newTokenHash = createHash('sha256').update(newPlaintextToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    const newRefreshToken = RefreshToken.create(
      newTokenId,
      existingToken.userId,
      newTokenHash,
      expiresAt,
    );
    await this.refreshTokenRepository.save(newRefreshToken);

    const accessToken = this.tokenSigner.sign({ sub: user.id, email: user.email }, '15m');

    this.logger.info('Token refreshed', { userId: user.id });

    return { accessToken, refreshToken: newPlaintextToken };
  }
}
