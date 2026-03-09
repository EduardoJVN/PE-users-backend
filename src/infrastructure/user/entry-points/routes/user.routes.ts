import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { UserController } from '@infra/user/entry-points/user.controller.js';
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

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
  }

  if (result.body === null) {
    res.status(result.status).end();
    return;
  }

  res.status(result.status).json(result.body);
}

export function createUserRouter(
  controller: UserController,
  jwtMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.use(jwtMiddleware);

  router.get('/me', async (req: Request, res: Response) => {
    const httpReq: HttpRequest = {
      ...toHttpRequest(req),
      userId: typeof res.locals['userId'] === 'string' ? res.locals['userId'] : undefined,
    };
    const result = await controller.getMe(httpReq);
    sendHttpResponse(res, result);
  });

  return router;
}
