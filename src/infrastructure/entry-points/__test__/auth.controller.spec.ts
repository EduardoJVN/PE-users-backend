import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../auth.controller.js';
import { InvalidCredentialsError } from '@domain/auth/errors/invalid-credentials.error.js';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';
import { RateLimitExceededError } from '@domain/auth/errors/rate-limit-exceeded.error.js';
import { EmailAlreadyExistsError } from '@domain/auth/errors/email-already-exists.error.js';
import type { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import type { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import type { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';
import type { RegisterUserUseCase } from '@application/auth/use-cases/register-user.use-case.js';
import type { VerifyEmailUseCase } from '@application/auth/use-cases/verify-email.use-case.js';
import type { ResendVerificationEmailUseCase } from '@application/auth/use-cases/resend-verification-email.use-case.js';
import type { ForgotPasswordUseCase } from '@application/auth/use-cases/forgot-password.use-case.js';
import type { ResetPasswordUseCase } from '@application/auth/use-cases/reset-password.use-case.js';

const mockLogin = { execute: vi.fn() };
const mockRefresh = { execute: vi.fn() };
const mockLogout = { execute: vi.fn() };
const mockRegister = { execute: vi.fn() };
const mockVerifyEmail = { execute: vi.fn() };
const mockResendVerification = { execute: vi.fn() };
const mockForgotPassword = { execute: vi.fn() };
const mockResetPassword = { execute: vi.fn() };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(
      mockLogin as unknown as LoginUseCase,
      mockRefresh as unknown as RefreshTokenUseCase,
      mockLogout as unknown as LogoutUseCase,
      mockRegister as unknown as RegisterUserUseCase,
      mockVerifyEmail as unknown as VerifyEmailUseCase,
      mockResendVerification as unknown as ResendVerificationEmailUseCase,
      mockForgotPassword as unknown as ForgotPasswordUseCase,
      mockResetPassword as unknown as ResetPasswordUseCase,
    );
  });

  describe('login', () => {
    it('returns 200 with accessToken in body and refreshToken cookie on success', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'plaintext-rt',
      });

      const response = await controller.login({
        body: { email: 'alice@example.com', password: 'login-input' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ accessToken: 'access-jwt' });
      expect(response.cookies).toHaveLength(1);
      expect(response.cookies![0].name).toBe('refreshToken');
      expect(response.cookies![0].value).toBe('plaintext-rt');
      expect(response.cookies![0].httpOnly).toBe(true);
      expect(response.cookies![0].secure).toBe(true);
      expect(response.cookies![0].sameSite).toBe('Strict');
    });

    it('returns 400 when body fails Zod validation without calling use case', async () => {
      const response = await controller.login({
        body: { email: 'not-an-email', password: 'login-input' },
      });

      expect(response.status).toBe(400);
      expect(mockLogin.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when body is missing required fields', async () => {
      const response = await controller.login({ body: { email: 'alice@example.com' } });

      expect(response.status).toBe(400);
      expect(mockLogin.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when use case throws InvalidCredentialsError', async () => {
      mockLogin.execute.mockRejectedValue(new InvalidCredentialsError());

      const response = await controller.login({
        body: { email: 'alice@example.com', password: 'wrong' },
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid email or password' });
    });

    it('returns 401 for unexpected errors (via 401 remapping)', async () => {
      mockLogin.execute.mockRejectedValue(new Error('Database down'));

      const response = await controller.login({
        body: { email: 'alice@example.com', password: 'login-input' },
      });

      // Unexpected errors are caught by handleRequest as 500, but our onError callback always returns 401
      expect(response.status).toBe(401);
    });
  });

  describe('refresh', () => {
    it('returns 200 with new accessToken and refreshToken cookie when token from cookie', async () => {
      mockRefresh.execute.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-rt' });

      const response = await controller.refresh({ cookies: { refreshToken: 'old-rt' } });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ accessToken: 'new-access' });
      expect(response.cookies![0].name).toBe('refreshToken');
      expect(response.cookies![0].value).toBe('new-rt');
    });

    it('returns 200 with new tokens when token from body', async () => {
      mockRefresh.execute.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-rt' });

      const response = await controller.refresh({ body: { refreshToken: 'body-rt' } });

      expect(response.status).toBe(200);
      expect(mockRefresh.execute).toHaveBeenCalledWith({ refreshToken: 'body-rt' });
    });

    it('returns 401 when neither cookie nor valid body token is present', async () => {
      const response = await controller.refresh({ body: {} });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Refresh token required' });
      expect(mockRefresh.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when no cookies and no body at all', async () => {
      const response = await controller.refresh({});

      expect(response.status).toBe(401);
      expect(mockRefresh.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when use case throws RefreshTokenInvalidError (from cookie)', async () => {
      mockRefresh.execute.mockRejectedValue(new RefreshTokenInvalidError());

      const response = await controller.refresh({ cookies: { refreshToken: 'bad-token' } });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Refresh token is invalid' });
    });

    it('returns 401 when use case throws RefreshTokenExpiredError (from cookie)', async () => {
      mockRefresh.execute.mockRejectedValue(new RefreshTokenExpiredError());

      const response = await controller.refresh({ cookies: { refreshToken: 'expired-token' } });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Refresh token has expired' });
    });

    it('returns 401 when use case throws RefreshTokenInvalidError (from body)', async () => {
      mockRefresh.execute.mockRejectedValue(new RefreshTokenInvalidError());

      const response = await controller.refresh({ body: { refreshToken: 'bad-token' } });

      expect(response.status).toBe(401);
    });

    it('returns 401 when use case throws RefreshTokenExpiredError (from body)', async () => {
      mockRefresh.execute.mockRejectedValue(new RefreshTokenExpiredError());

      const response = await controller.refresh({ body: { refreshToken: 'expired-token' } });

      expect(response.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('returns 204 on success with refreshToken from cookie', async () => {
      mockLogout.execute.mockResolvedValue(undefined);

      const response = await controller.logout({ cookies: { refreshToken: 'rt-from-cookie' } });

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
      expect(mockLogout.execute).toHaveBeenCalledWith({
        refreshToken: 'rt-from-cookie',
        accessToken: undefined,
      });
    });

    it('returns 204 with accessToken extracted from Authorization header', async () => {
      mockLogout.execute.mockResolvedValue(undefined);

      const response = await controller.logout({
        cookies: { refreshToken: 'rt' },
        headers: { authorization: 'Bearer my-access-token' },
      });

      expect(response.status).toBe(204);
      expect(mockLogout.execute).toHaveBeenCalledWith({
        refreshToken: 'rt',
        accessToken: 'my-access-token',
      });
    });

    it('returns 204 with refreshToken from body when no cookie', async () => {
      mockLogout.execute.mockResolvedValue(undefined);

      const response = await controller.logout({ body: { refreshToken: 'body-rt' } });

      expect(response.status).toBe(204);
      expect(mockLogout.execute).toHaveBeenCalledWith({
        refreshToken: 'body-rt',
        accessToken: undefined,
      });
    });

    it('returns 204 even when no token provided (idempotent logout)', async () => {
      mockLogout.execute.mockResolvedValue(undefined);

      const response = await controller.logout({});

      expect(response.status).toBe(204);
      expect(mockLogout.execute).toHaveBeenCalledWith({
        refreshToken: '',
        accessToken: undefined,
      });
    });

    it('returns the error status when use case throws an unexpected error', async () => {
      mockLogout.execute.mockRejectedValue(new Error('Unexpected failure'));

      const response = await controller.logout({ cookies: { refreshToken: 'rt' } });

      expect(response.status).toBe(500);
    });
  });

  describe('register', () => {
    const validBody = {
      email: 'alice@example.com',
      password: 'StrongPass1!',
      name: 'Alice',
      lastName: 'Smith',
    };

    it('returns 201 with user data on success', async () => {
      mockRegister.execute.mockResolvedValue({
        id: 'user-id-1',
        email: 'alice@example.com',
        name: 'Alice',
        lastName: 'Smith',
      });

      const response = await controller.register({ body: validBody });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 'user-id-1',
        email: 'alice@example.com',
        name: 'Alice',
        lastName: 'Smith',
      });
    });

    it('returns 400 when email is invalid', async () => {
      const response = await controller.register({ body: { ...validBody, email: 'not-an-email' } });

      expect(response.status).toBe(400);
      expect(mockRegister.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when password is too short', async () => {
      const response = await controller.register({ body: { ...validBody, password: 'Ab1!' } });

      expect(response.status).toBe(400);
      expect(mockRegister.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when password has no uppercase letter', async () => {
      const response = await controller.register({
        body: { ...validBody, password: 'weakpass1!' },
      });

      expect(response.status).toBe(400);
      expect(mockRegister.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when password has no number', async () => {
      const response = await controller.register({ body: { ...validBody, password: 'WeakPass!' } });

      expect(response.status).toBe(400);
      expect(mockRegister.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when password has no special character', async () => {
      const response = await controller.register({ body: { ...validBody, password: 'WeakPass1' } });

      expect(response.status).toBe(400);
      expect(mockRegister.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when use case throws EmailAlreadyExistsError', async () => {
      mockRegister.execute.mockRejectedValue(new EmailAlreadyExistsError('alice@example.com'));

      const response = await controller.register({ body: validBody });

      expect(response.status).toBe(400);
    });
  });

  describe('verifyEmail', () => {
    it('returns 200 with success message on valid token', async () => {
      mockVerifyEmail.execute.mockResolvedValue({ message: 'Email verified successfully' });

      const response = await controller.verifyEmail({ query: { token: 'plaintext-token' } });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Email verified successfully' });
      expect(mockVerifyEmail.execute).toHaveBeenCalledWith({ token: 'plaintext-token' });
    });

    it('returns 400 when token query param is missing', async () => {
      const response = await controller.verifyEmail({ query: {} });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing token query parameter' });
      expect(mockVerifyEmail.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when query is undefined', async () => {
      const response = await controller.verifyEmail({});

      expect(response.status).toBe(400);
      expect(mockVerifyEmail.execute).not.toHaveBeenCalled();
    });

    it('returns error status when use case throws a domain error', async () => {
      mockVerifyEmail.execute.mockRejectedValue(new Error('unexpected'));

      const response = await controller.verifyEmail({ query: { token: 'some-token' } });

      expect(response.status).toBe(500);
    });
  });

  describe('resendVerification', () => {
    const validBody = { userId: '123e4567-e89b-12d3-a456-426614174000' };

    it('returns 200 with message on success', async () => {
      mockResendVerification.execute.mockResolvedValue({ message: 'Verification email sent' });

      const response = await controller.resendVerification({ body: validBody });

      expect(response.status).toBe(200);
      expect(mockResendVerification.execute).toHaveBeenCalledWith({
        userId: validBody.userId,
        rateLimitKey: `resend:userId:${validBody.userId}`,
      });
    });

    it('returns 400 when userId is not a valid UUID', async () => {
      const response = await controller.resendVerification({ body: { userId: 'not-a-uuid' } });

      expect(response.status).toBe(400);
      expect(mockResendVerification.execute).not.toHaveBeenCalled();
    });

    it('returns 429 when use case throws RateLimitExceededError', async () => {
      mockResendVerification.execute.mockRejectedValue(new RateLimitExceededError(120));

      const response = await controller.resendVerification({ body: validBody });

      expect(response.status).toBe(429);
    });
  });

  describe('forgotPassword', () => {
    it('returns 200 with generic message on success (anti-enumeration)', async () => {
      mockForgotPassword.execute.mockResolvedValue(undefined);

      const response = await controller.forgotPassword({ body: { email: 'alice@example.com' } });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'If your account exists, a password reset email has been sent',
      });
      expect(mockForgotPassword.execute).toHaveBeenCalledWith({
        email: 'alice@example.com',
        rateLimitKey: 'forgot:email:alice@example.com',
      });
    });

    it('returns 400 when email is invalid', async () => {
      const response = await controller.forgotPassword({ body: { email: 'not-an-email' } });

      expect(response.status).toBe(400);
      expect(mockForgotPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 429 when use case throws RateLimitExceededError', async () => {
      mockForgotPassword.execute.mockRejectedValue(new RateLimitExceededError(60));

      const response = await controller.forgotPassword({ body: { email: 'alice@example.com' } });

      expect(response.status).toBe(429);
    });
  });

  describe('resetPassword', () => {
    const validBody = { token: 'reset-token', newPassword: 'NewPass123!' };

    it('returns 200 with message on success', async () => {
      mockResetPassword.execute.mockResolvedValue({ message: 'Password reset successfully' });

      const response = await controller.resetPassword({ body: validBody });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Password reset successfully' });
      expect(mockResetPassword.execute).toHaveBeenCalledWith(validBody);
    });

    it('returns 400 when token is missing', async () => {
      const response = await controller.resetPassword({ body: { newPassword: 'NewPass123!' } });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when newPassword is missing', async () => {
      const response = await controller.resetPassword({ body: { token: 'some-token' } });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when newPassword is too short', async () => {
      const response = await controller.resetPassword({
        body: { token: 'reset-token', newPassword: 'Ab1!' },
      });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when newPassword has no uppercase letter', async () => {
      const response = await controller.resetPassword({
        body: { token: 'reset-token', newPassword: 'weakpass1!' },
      });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when newPassword has no number', async () => {
      const response = await controller.resetPassword({
        body: { token: 'reset-token', newPassword: 'WeakPass!' },
      });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when newPassword has no special character', async () => {
      const response = await controller.resetPassword({
        body: { token: 'reset-token', newPassword: 'WeakPass1' },
      });

      expect(response.status).toBe(400);
      expect(mockResetPassword.execute).not.toHaveBeenCalled();
    });

    it('returns error status when use case throws', async () => {
      mockResetPassword.execute.mockRejectedValue(new Error('unexpected'));

      const response = await controller.resetPassword({ body: validBody });

      expect(response.status).toBe(500);
    });
  });
});
