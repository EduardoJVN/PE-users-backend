import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { ENV } from '@infra/config/env.config.js';
import { PrismaUserAdapter } from '@infra/user/adapters/prisma-user.adapter.js';
import { PrismaRefreshTokenAdapter } from '@infra/auth/adapters/prisma-refresh-token.adapter.js';
import { PrismaEmailVerificationTokenAdapter } from '@infra/auth/adapters/prisma-email-verification-token.adapter.js';
import { InMemoryTokenBlacklistAdapter } from '@infra/auth/adapters/in-memory-token-blacklist.adapter.js';
import { BcryptPasswordHasherAdapter } from '@infra/auth/adapters/bcrypt-password-hasher.adapter.js';
import { JwtTokenSignerAdapter } from '@infra/auth/adapters/jwt-token-signer.adapter.js';
import { ResendEmailAdapter } from '@infra/auth/adapters/resend-email.adapter.js';
import { InMemoryRateLimiterAdapter } from '@infra/auth/adapters/in-memory-rate-limiter.adapter.js';
import { GoogleOAuthAdapter } from '@infra/auth/adapters/google-oauth.adapter.js';
import { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';
import { RegisterUserUseCase } from '@application/auth/use-cases/register-user.use-case.js';
import { VerifyEmailUseCase } from '@application/auth/use-cases/verify-email.use-case.js';
import { ResendVerificationEmailUseCase } from '@application/auth/use-cases/resend-verification-email.use-case.js';
import { ForgotPasswordUseCase } from '@application/auth/use-cases/forgot-password.use-case.js';
import { ResetPasswordUseCase } from '@application/auth/use-cases/reset-password.use-case.js';
import { GoogleOAuthCallbackUseCase } from '@application/auth/use-cases/google-oauth-callback.use-case.js';
import { AuthController } from '@infra/auth/entry-points/auth.controller.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { ITokenSigner } from '@domain/auth/ports/token-signer.port.js';
import type { ITokenBlacklist } from '@domain/auth/ports/token-blacklist.port.js';

export interface AuthModule {
  controller: AuthController;
  tokenSigner: ITokenSigner;
  tokenBlacklist: ITokenBlacklist;
}

export async function createAuthModule(prisma: PrismaClient, logger: ILogger): Promise<AuthModule> {
  // --- Adapters ---
  const userRepo = new PrismaUserAdapter(prisma);
  const refreshTokenRepo = new PrismaRefreshTokenAdapter(prisma);
  const evtRepo = new PrismaEmailVerificationTokenAdapter(prisma);
  const tokenBlacklist = new InMemoryTokenBlacklistAdapter();
  const passwordHasher = new BcryptPasswordHasherAdapter();
  const tokenSigner = new JwtTokenSignerAdapter(
    ENV.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ENV.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
  );
  const emailSender = new ResendEmailAdapter(ENV.RESEND_API_KEY, ENV.RESEND_FROM_EMAIL);
  const rateLimiter = new InMemoryRateLimiterAdapter();
  const googleOAuthAdapter = new GoogleOAuthAdapter(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_CALLBACK_URL,
  );

  // --- Use cases ---
  const dummyHash = await passwordHasher.hash(randomUUID());

  const loginUseCase = new LoginUseCase(
    userRepo,
    refreshTokenRepo,
    tokenSigner,
    passwordHasher,
    logger,
    ENV.REFRESH_TOKEN_TTL_DAYS,
    dummyHash,
  );
  const refreshTokenUseCase = new RefreshTokenUseCase(
    refreshTokenRepo,
    userRepo,
    tokenSigner,
    logger,
    ENV.REFRESH_TOKEN_TTL_DAYS,
  );
  const logoutUseCase = new LogoutUseCase(refreshTokenRepo, tokenBlacklist, logger);
  const registerUserUseCase = new RegisterUserUseCase(
    userRepo,
    evtRepo,
    passwordHasher,
    emailSender,
    logger,
    `${ENV.FRONTEND_URL}/auth/verify-email`,
    ENV.VERIFICATION_TOKEN_TTL_MS,
  );
  const verifyEmailUseCase = new VerifyEmailUseCase(userRepo, evtRepo, logger);
  const resendVerificationUseCase = new ResendVerificationEmailUseCase(
    userRepo,
    evtRepo,
    emailSender,
    rateLimiter,
    logger,
    `${ENV.FRONTEND_URL}/auth/verify-email`,
    ENV.VERIFICATION_TOKEN_TTL_MS,
    ENV.RATE_LIMIT_WINDOW_MS,
    ENV.RATE_LIMIT_MAX_ATTEMPTS,
  );
  const forgotPasswordUseCase = new ForgotPasswordUseCase(
    userRepo,
    evtRepo,
    emailSender,
    rateLimiter,
    logger,
    `${ENV.FRONTEND_URL}/auth/reset-password`,
    ENV.RESET_TOKEN_TTL_MS,
    ENV.RATE_LIMIT_WINDOW_MS,
    ENV.RATE_LIMIT_MAX_ATTEMPTS,
  );
  const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, evtRepo, passwordHasher, logger);
  const googleOAuthCallbackUseCase = new GoogleOAuthCallbackUseCase(
    userRepo,
    refreshTokenRepo,
    tokenSigner,
    googleOAuthAdapter,
    logger,
    ENV.REFRESH_TOKEN_TTL_DAYS,
  );

  // --- Controller ---
  const controller = new AuthController(
    loginUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    registerUserUseCase,
    verifyEmailUseCase,
    resendVerificationUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
    googleOAuthCallbackUseCase,
    googleOAuthAdapter.getAuthUrl(),
  );

  return { controller, tokenSigner, tokenBlacklist };
}
