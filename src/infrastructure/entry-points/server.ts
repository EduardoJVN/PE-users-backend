import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';
import type { AuthController } from '@infra/entry-points/auth.controller.js';
import { createAuthRouter } from '@infra/entry-points/routes/auth.routes.js';
import { openApiSpec } from '@infra/entry-points/docs/openapi.js';

export function createServer(authController: AuthController): Application {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/swagger', swaggerUi.serve);
  app.get('/swagger', swaggerUi.setup(openApiSpec));
  app.get('/swagger.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use('/auth', createAuthRouter(authController));

  app.use('/health', (req, res) => {
    res.status(200).send('OK');
  });

  return app;
}
