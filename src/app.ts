import { randomUUID } from 'node:crypto';
import { reportBootstrap } from '@infra/config/bootstrap-reporter.js';
import { ENV } from '@infra/config/env.config.js';
import { prisma } from '@infra/config/prisma.js';
import { Logger } from '@infra/adapters/pino-logger.adapter.js';
import { LogErrorReporter } from '@infra/adapters/log-error-reporter.adapter.js';
import { PrismaUserAdapter } from '@infra/user/adapters/prisma-user.adapter.js';
import { PrismaRefreshTokenAdapter } from '@infra/auth/adapters/prisma-refresh-token.adapter.js';
import { InMemoryTokenBlacklistAdapter } from '@infra/auth/adapters/in-memory-token-blacklist.adapter.js';
import { BcryptPasswordHasherAdapter } from '@infra/auth/adapters/bcrypt-password-hasher.adapter.js';
import { JwtTokenSignerAdapter } from '@infra/auth/adapters/jwt-token-signer.adapter.js';
import { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';
import { RegisterUserUseCase } from '@application/auth/use-cases/register-user.use-case.js';
import { VerifyEmailUseCase } from '@application/auth/use-cases/verify-email.use-case.js';
import { ResendVerificationEmailUseCase } from '@application/auth/use-cases/resend-verification-email.use-case.js';
import { ForgotPasswordUseCase } from '@application/auth/use-cases/forgot-password.use-case.js';
import { ResetPasswordUseCase } from '@application/auth/use-cases/reset-password.use-case.js';
import { PrismaEmailVerificationTokenAdapter } from '@infra/auth/adapters/prisma-email-verification-token.adapter.js';
import { ResendEmailAdapter } from '@infra/auth/adapters/resend-email.adapter.js';
import { InMemoryRateLimiterAdapter } from '@infra/auth/adapters/in-memory-rate-limiter.adapter.js';
import { GoogleOAuthAdapter } from '@infra/auth/adapters/google-oauth.adapter.js';
import { GoogleOAuthCallbackUseCase } from '@application/auth/use-cases/google-oauth-callback.use-case.js';
import { GetMeUseCase } from '@application/user/use-cases/get-me.use-case.js';
import { AuthController } from '@infra/auth/entry-points/auth.controller.js';
import { UserController } from '@infra/user/entry-points/user.controller.js';
import { createServer } from '@infra/entry-points/server.js';

async function bootstrap() {
  const logger = new Logger();
  const errorReporter = new LogErrorReporter(logger);

  process.on('uncaughtException', (err) => {
    errorReporter.report(err, { type: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    errorReporter.report(reason, { type: 'unhandledRejection' });
    process.exit(1);
  });

  // --- Database ---
  await prisma.$connect();
  logger.info('Database connected');

  // --- Adapters ---
  const userRepo = new PrismaUserAdapter(prisma);
  const refreshTokenRepo = new PrismaRefreshTokenAdapter(prisma);

  const tokenBlacklist = new InMemoryTokenBlacklistAdapter();
  const passwordHasher = new BcryptPasswordHasherAdapter();
  const tokenSigner = new JwtTokenSignerAdapter(
    ENV.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ENV.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
  );

  // --- New adapters ---
  const evtRepo = new PrismaEmailVerificationTokenAdapter(prisma);
  const emailSender = new ResendEmailAdapter(ENV.RESEND_API_KEY, ENV.RESEND_FROM_EMAIL);
  const rateLimiter = new InMemoryRateLimiterAdapter();

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

  // --- Google OAuth ---
  const googleOAuthAdapter = new GoogleOAuthAdapter(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_CALLBACK_URL,
  );
  const googleOAuthCallbackUseCase = new GoogleOAuthCallbackUseCase(
    userRepo,
    refreshTokenRepo,
    tokenSigner,
    googleOAuthAdapter,
    logger,
    ENV.REFRESH_TOKEN_TTL_DAYS,
  );

  // --- User use cases ---
  const getMeUseCase = new GetMeUseCase(userRepo, logger);

  // --- Controllers ---
  const userController = new UserController(getMeUseCase);
  const authController = new AuthController(
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

  // --- Server ---
  const app = createServer(
    authController,
    errorReporter,
    userController,
    tokenSigner,
    tokenBlacklist,
  );

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  app.listen(ENV.PORT, () => {
    reportBootstrap(logger);
  });
}

bootstrap();
