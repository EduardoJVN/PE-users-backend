import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../user.controller.js';
import { UserNotFoundError } from '@domain/user/errors/user-not-found.error.js';
import type { GetMeUseCase } from '@application/user/use-cases/get-me.use-case.js';

const mockGetMe = { execute: vi.fn() };

describe('UserController', () => {
  let controller: UserController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserController(mockGetMe as unknown as GetMeUseCase);
  });

  describe('getMe', () => {
    it('returns 401 when req.userId is missing', async () => {
      const result = await controller.getMe({ body: {} });

      expect(result).toEqual({ status: 401, body: { error: 'Unauthorized' } });
      expect(mockGetMe.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when req.userId is empty string', async () => {
      const result = await controller.getMe({ userId: '' });

      expect(result).toEqual({ status: 401, body: { error: 'Unauthorized' } });
      expect(mockGetMe.execute).not.toHaveBeenCalled();
    });

    it('returns 200 with user data on happy path', async () => {
      const now = new Date();
      const userResult = {
        id: 'user-123',
        email: 'john@example.com',
        name: 'John',
        lastName: 'Doe',
        avatarUrl: null,
        statusId: 1,
        roleId: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      mockGetMe.execute.mockResolvedValue(userResult);

      const result = await controller.getMe({ userId: 'user-123' });

      expect(result).toEqual({ status: 200, body: userResult });
      expect(mockGetMe.execute).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('returns 404 when use case throws UserNotFoundError', async () => {
      mockGetMe.execute.mockRejectedValue(new UserNotFoundError('user-999'));

      const result = await controller.getMe({ userId: 'user-999' });

      expect(result.status).toBe(404);
      expect(result.body).toEqual({ error: 'User not found: user-999' });
    });

    it('returns 500 when use case throws unexpected error', async () => {
      mockGetMe.execute.mockRejectedValue(new Error('Database failure'));

      const result = await controller.getMe({ userId: 'user-123' });

      expect(result.status).toBe(500);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });
  });
});
