import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenBlacklist } from '@domain/auth/ports/token-blacklist.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { LogoutCommand } from '@application/auth/dto/logout-auth.dto.js';

export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenBlacklist: ITokenBlacklist,
    private readonly logger: ILogger,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const token = await this.refreshTokenRepository.findById(command.refreshToken);

    if (token === null) {
      // Idempotent — token already gone, nothing to do
      return;
    }

    await this.refreshTokenRepository.delete(command.refreshToken);

    if (command.accessToken !== undefined) {
      // Best-effort blacklisting — use token's expiry as the blacklist TTL
      // We use the refresh token's expiresAt as a reasonable upper bound
      // (access token lifetime is shorter but we don't have its expiry here)
      await this.tokenBlacklist.add(command.accessToken, token.expiresAt);
    }

    this.logger.info('User logged out', { userId: token.userId });
  }
}
