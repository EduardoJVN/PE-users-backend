import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AuthController } from '@infra/entry-points/auth.controller.js';
import type {
  HttpRequest,
  HttpResponse,
  ResponseCookie,
} from '@infra/entry-points/base.controller.js';

function toHttpRequest(req: Request): HttpRequest {
  return {
    body: req.body as unknown,
    params: req.params as Record<string, string>,
    query: req.query as Record<string, string>,
    cookies: req.cookies as Record<string, string>,
    headers: req.headers as Record<string, string>,
  };
}

function sendHttpResponse(res: Response, result: HttpResponse): void {
  if (result.cookies) {
    for (const cookie of result.cookies) {
      res.cookie(cookie.name, cookie.value, {
        httpOnly: cookie.httpOnly,
        maxAge: cookie.maxAge ? cookie.maxAge * 1000 : undefined,
        sameSite: cookie.sameSite as ResponseCookie['sameSite'],
        secure: cookie.secure,
        path: '/',
      });
    }
  }

  if (result.body === null) {
    res.status(result.status).end();
    return;
  }

  res.status(result.status).json(result.body);
}

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    const result = await controller.login(toHttpRequest(req));
    sendHttpResponse(res, result);
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    const result = await controller.refresh(toHttpRequest(req));
    sendHttpResponse(res, result);
  });

  router.post('/logout', async (req: Request, res: Response) => {
    const result = await controller.logout(toHttpRequest(req));
    sendHttpResponse(res, result);
  });

  return router;
}
