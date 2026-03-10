import type { PrismaClient } from '@prisma/client';
import { createAuthModule, type AuthModule } from '@infra/auth/module/auth.module.js';
import { createUserModule, type UserModule } from '@infra/user/module/user.module.js';
import type { ILogger } from '@domain/ports/logger.port.js';

export interface AppModule {
  auth: AuthModule;
  user: UserModule;
}

export async function createAppModule(prisma: PrismaClient, logger: ILogger): Promise<AppModule> {
  const auth = await createAuthModule(prisma, logger);
  const user = createUserModule(prisma, logger);

  return { auth, user };
}
