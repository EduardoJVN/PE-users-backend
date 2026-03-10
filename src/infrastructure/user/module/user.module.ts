import type { PrismaClient } from '@prisma/client';
import { PrismaUserAdapter } from '@infra/user/adapters/prisma-user.adapter.js';
import { GetMeUseCase } from '@application/user/use-cases/get-me.use-case.js';
import { UserController } from '@infra/user/entry-points/user.controller.js';
import type { ILogger } from '@domain/ports/logger.port.js';

export interface UserModule {
  controller: UserController;
}

export function createUserModule(prisma: PrismaClient, logger: ILogger): UserModule {
  const userRepo = new PrismaUserAdapter(prisma);
  const getMeUseCase = new GetMeUseCase(userRepo, logger);
  const controller = new UserController(getMeUseCase);

  return { controller };
}
