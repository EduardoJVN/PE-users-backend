import { z } from 'zod';
import { BaseController } from './base.controller.js';
import type { HttpRequest, HttpResponse } from './base.controller.js';
import type { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import type { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import type { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

export class AuthController extends BaseController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {
    super();
  }

  async login(req: HttpRequest): Promise<HttpResponse> {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };

    return this.handleRequest(
      () => this.loginUseCase.execute(parsed.data),
      (result) => ({
        status: 200,
        body: { accessToken: result.accessToken },
        cookies: [
          {
            name: 'refreshToken',
            value: result.refreshToken,
            httpOnly: true,
            maxAge: REFRESH_TOKEN_MAX_AGE,
            sameSite: 'Strict' as const,
            secure: true,
          },
        ],
      }),
      (error) => ({ status: 401, body: { error: error.message } }),
    );
  }

  async refresh(req: HttpRequest): Promise<HttpResponse> {
    const tokenFromCookie = req.cookies?.refreshToken;

    if (tokenFromCookie !== undefined) {
      return this.handleRequest(
        () => this.refreshTokenUseCase.execute({ refreshToken: tokenFromCookie }),
        (result) => ({
          status: 200,
          body: { accessToken: result.accessToken },
          cookies: [
            {
              name: 'refreshToken',
              value: result.refreshToken,
              httpOnly: true,
              maxAge: REFRESH_TOKEN_MAX_AGE,
              sameSite: 'Strict' as const,
              secure: true,
            },
          ],
        }),
        (error) => ({ status: 401, body: { error: error.message } }),
      );
    }

    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return { status: 401, body: { error: 'Refresh token required' } };
    }

    return this.handleRequest(
      () => this.refreshTokenUseCase.execute({ refreshToken: parsed.data.refreshToken }),
      (result) => ({
        status: 200,
        body: { accessToken: result.accessToken },
        cookies: [
          {
            name: 'refreshToken',
            value: result.refreshToken,
            httpOnly: true,
            maxAge: REFRESH_TOKEN_MAX_AGE,
            sameSite: 'Strict' as const,
            secure: true,
          },
        ],
      }),
      (error) => ({ status: 401, body: { error: error.message } }),
    );
  }

  async logout(req: HttpRequest): Promise<HttpResponse> {
    const refreshToken =
      req.cookies?.refreshToken ??
      (req.body as Record<string, string> | undefined)?.refreshToken ??
      '';
    const accessToken = req.headers?.authorization?.replace('Bearer ', '');

    return this.handleRequest(
      () => this.logoutUseCase.execute({ refreshToken, accessToken }),
      () => ({ status: 204, body: null }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }
}
