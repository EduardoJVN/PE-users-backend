import { randomUUID, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { User } from '@domain/user/entities/user.entity.js';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import { UserStatusId, UserRoleId, RegisterTypeId } from '@domain/catalog-ids.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';
import type { ITokenSigner } from '@domain/auth/ports/token-signer.port.js';
import type { IGoogleOAuthPort } from '@domain/auth/ports/google-oauth.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type {
  GoogleOAuthCallbackCommand,
  GoogleOAuthCallbackResult,
} from '@application/auth/dto/google-oauth-callback-auth.dto.js';

export class GoogleOAuthCallbackUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly tokenSigner: ITokenSigner,
    private readonly googleOAuth: IGoogleOAuthPort,
    private readonly logger: ILogger,
    private readonly refreshTokenTtlDays: number,
  ) {}

  async execute(command: GoogleOAuthCallbackCommand): Promise<GoogleOAuthCallbackResult> {
    const profile = await this.googleOAuth.getProfile(command.code);

    // Branch A: returning Google user
    const existingByGoogleId = await this.userRepo.findByGoogleId(profile.googleId);
    if (existingByGoogleId !== null) {
      this.logger.info('Google OAuth: returning user', { userId: existingByGoogleId.id });
      return this.issueTokens(existingByGoogleId);
    }

    // Branch B: email already registered — link Google account
    const existingByEmail = await this.userRepo.findByEmail(profile.email);
    if (existingByEmail !== null) {
      const linked = existingByEmail.linkGoogle(profile.googleId);
      await this.userRepo.update(linked);
      this.logger.info('Google OAuth: linked Google account to existing user', {
        userId: linked.id,
      });
      return this.issueTokens(linked);
    }

    // Branch C: new user — create and activate immediately
    const userId = uuidv7();
    const newUser = User.create(
      userId,
      profile.email,
      null,
      profile.name,
      profile.lastName,
      profile.googleId,
      UserStatusId.PENDING,
      UserRoleId.USER,
      RegisterTypeId.GOOGLE,
    );
    const activatedUser = newUser.activate(UserStatusId.ACTIVE);
    await this.userRepo.save(activatedUser);
    this.logger.info('Google OAuth: new user registered', { userId: activatedUser.id });
    return this.issueTokens(activatedUser);
  }

  private async issueTokens(user: User): Promise<GoogleOAuthCallbackResult> {
    const tokenId = uuidv7();
    const plaintextToken = randomUUID();
    const tokenHash = createHash('sha256').update(plaintextToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    const refreshToken = RefreshToken.create(tokenId, user.id, tokenHash, expiresAt);
    await this.refreshTokenRepo.save(refreshToken);

    const accessToken = this.tokenSigner.sign({ sub: user.id, email: user.email }, '15m');

    return { accessToken, refreshToken: plaintextToken, userId: user.id };
  }
}
