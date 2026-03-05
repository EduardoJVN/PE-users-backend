import { randomUUID } from 'node:crypto';
import { reportBootstrap } from '@infra/config/bootstrap-reporter.js';
import { ENV } from '@infra/config/env.config.js';
import { prisma } from '@infra/config/prisma.js';
import { Logger } from '@infra/adapters/pino-logger.adapter.js';
import { PrismaUserAdapter } from '@infra/adapters/prisma-user.adapter.js';
import { PrismaRefreshTokenAdapter } from '@infra/adapters/prisma-refresh-token.adapter.js';
import { InMemoryTokenBlacklistAdapter } from '@infra/adapters/in-memory-token-blacklist.adapter.js';
import { BcryptPasswordHasherAdapter } from '@infra/adapters/bcrypt-password-hasher.adapter.js';
import { JwtTokenSignerAdapter } from '@infra/adapters/jwt-token-signer.adapter.js';
import { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';
import { AuthController } from '@infra/entry-points/auth.controller.js';
import { createServer } from '@infra/entry-points/server.js';

async function bootstrap() {
  const logger = new Logger();

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

  // --- Controllers ---
  const authController = new AuthController(loginUseCase, refreshTokenUseCase, logoutUseCase);

  // --- Server ---
  const app = createServer(authController);

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  app.listen(ENV.PORT, () => {
    reportBootstrap(logger);
  });
}

bootstrap();
