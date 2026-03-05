import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../auth.controller.js';
import { InvalidCredentialsError } from '@domain/auth/errors/invalid-credentials.error.js';
import { RefreshTokenInvalidError } from '@domain/auth/errors/refresh-token-invalid.error.js';
import { RefreshTokenExpiredError } from '@domain/auth/errors/refresh-token-expired.error.js';
import type { LoginUseCase } from '@application/auth/use-cases/login.use-case.js';
import type { RefreshTokenUseCase } from '@application/auth/use-cases/refresh-token.use-case.js';
import type { LogoutUseCase } from '@application/auth/use-cases/logout.use-case.js';

const mockLogin = { execute: vi.fn() };
const mockRefresh = { execute: vi.fn() };
const mockLogout = { execute: vi.fn() };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(
      mockLogin as unknown as LoginUseCase,
      mockRefresh as unknown as RefreshTokenUseCase,
      mockLogout as unknown as LogoutUseCase,
    );
  });

  describe('login', () => {
    it('returns 200 with accessToken in body and refreshToken cookie on success', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'plaintext-rt',
      });

      const response = await controller.login({
        body: { email: 'alice@example.com', password: 'secret' },
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
        body: { email: 'not-an-email', password: 'secret' },
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
        body: { email: 'alice@example.com', password: 'secret' },
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
});
