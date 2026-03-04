import express from 'express';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import type { AuthController } from '@infra/entry-points/auth.controller.js';
import { createAuthRouter } from '@infra/entry-points/routes/auth.routes.js';

export function createServer(authController: AuthController): Application {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/auth', createAuthRouter(authController));

  return app;
}
