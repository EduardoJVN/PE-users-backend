import { BaseController } from './base.controller.js';
import type { HttpRequest, HttpResponse } from './base.controller.js';
import { ENV } from '@infra/config/env.config.js';
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  ResendVerificationSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  GoogleCallbackSchema,
} from './schemas/auth.schemas.js';
import type { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import type { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import type { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';
import type { RegisterUserUseCase } from '@application/auth/use-cases/register-user.use-case.js';
import type { VerifyEmailUseCase } from '@application/auth/use-cases/verify-email.use-case.js';
import type { ResendVerificationEmailUseCase } from '@application/auth/use-cases/resend-verification-email.use-case.js';
import type { ForgotPasswordUseCase } from '@application/auth/use-cases/forgot-password.use-case.js';
import type { ResetPasswordUseCase } from '@application/auth/use-cases/reset-password.use-case.js';
import type { GoogleOAuthCallbackUseCase } from '@application/auth/use-cases/google-oauth-callback.use-case.js';

const REFRESH_TOKEN_MAX_AGE = ENV.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

export class AuthController extends BaseController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationUseCase: ResendVerificationEmailUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly googleOAuthCallbackUseCase: GoogleOAuthCallbackUseCase,
    private readonly googleAuthUrl: string,
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

  async register(req: HttpRequest): Promise<HttpResponse> {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };
    return this.handleRequest(
      () => this.registerUseCase.execute({ id: '', ...parsed.data }),
      (result) => ({ status: 201, body: result }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }

  async verifyEmail(req: HttpRequest): Promise<HttpResponse> {
    const token = req.query?.token ?? '';
    if (!token) return { status: 400, body: { error: 'Missing token query parameter' } };
    return this.handleRequest(
      () => this.verifyEmailUseCase.execute({ token }),
      (result) => ({ status: 200, body: result }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }

  async resendVerification(req: HttpRequest): Promise<HttpResponse> {
    const parsed = ResendVerificationSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };
    const rateLimitKey = `resend:userId:${parsed.data.userId}`;
    return this.handleRequest(
      () => this.resendVerificationUseCase.execute({ userId: parsed.data.userId, rateLimitKey }),
      (result) => ({ status: 200, body: result }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }

  async forgotPassword(req: HttpRequest): Promise<HttpResponse> {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };
    const rateLimitKey = `forgot:email:${parsed.data.email}`;
    return this.handleRequest(
      () => this.forgotPasswordUseCase.execute({ email: parsed.data.email, rateLimitKey }),
      () => ({
        status: 200,
        body: { message: 'If your account exists, a password reset email has been sent' },
      }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }

  async resetPassword(req: HttpRequest): Promise<HttpResponse> {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };
    return this.handleRequest(
      () => this.resetPasswordUseCase.execute(parsed.data),
      (result) => ({ status: 200, body: result }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }

  googleUrl(_req: HttpRequest): HttpResponse {
    return { status: 200, body: { url: this.googleAuthUrl } };
  }

  async googleCallback(req: HttpRequest): Promise<HttpResponse> {
    const parsed = GoogleCallbackSchema.safeParse(req.body);
    if (!parsed.success) return { status: 400, body: { error: parsed.error.message } };

    return this.handleRequest(
      () => this.googleOAuthCallbackUseCase.execute({ code: parsed.data.code }),
      (result) => ({
        status: 200,
        body: { accessToken: result.accessToken, userId: result.userId },
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
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }
}
