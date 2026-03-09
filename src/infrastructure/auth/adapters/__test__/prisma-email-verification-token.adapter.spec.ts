import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaEmailVerificationTokenAdapter } from '@infra/auth/adapters/prisma-email-verification-token.adapter.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';

const makeEntity = (
  overrides?: Partial<{ id: string; userId: string; type: 'VERIFY' | 'RESET' }>,
): EmailVerificationToken => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return EmailVerificationToken.create(
    overrides?.id ?? 'evt-1',
    overrides?.userId ?? 'user-1',
    'hashed-token-abc',
    overrides?.type ?? 'VERIFY',
    expiresAt,
  );
};

const makeRow = (entity: EmailVerificationToken) => ({
  id: entity.id,
  userId: entity.userId,
  tokenHash: entity.tokenHash,
  type: entity.type,
  expiresAt: entity.expiresAt,
  usedAt: entity.usedAt,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

describe('PrismaEmailVerificationTokenAdapter', () => {
  let mockDb: PrismaClient;
  let adapter: PrismaEmailVerificationTokenAdapter;

  beforeEach(() => {
    mockDb = {
      emailVerificationToken: {
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    adapter = new PrismaEmailVerificationTokenAdapter(mockDb);
  });

  describe('findByTokenHash', () => {
    it('returns an entity when a matching row is found', async () => {
      const entity = makeEntity();
      const row = makeRow(entity);

      vi.mocked(mockDb.emailVerificationToken.findFirst).mockResolvedValue(row as never);

      const result = await adapter.findByTokenHash('hashed-token-abc');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(entity.id);
      expect(result!.userId).toBe(entity.userId);
      expect(result!.tokenHash).toBe(entity.tokenHash);
      expect(result!.type).toBe(entity.type);
    });

    it('returns null when no row matches the token hash', async () => {
      vi.mocked(mockDb.emailVerificationToken.findFirst).mockResolvedValue(null as never);

      const result = await adapter.findByTokenHash('nonexistent-hash');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('calls $transaction with deleteMany and create operations', async () => {
      const entity = makeEntity();

      vi.mocked(mockDb.$transaction).mockResolvedValue([]);
      vi.mocked(mockDb.emailVerificationToken.deleteMany).mockResolvedValue({ count: 0 } as never);
      vi.mocked(mockDb.emailVerificationToken.create).mockResolvedValue(makeRow(entity) as never);

      await adapter.save(entity);

      expect(mockDb.$transaction).toHaveBeenCalledOnce();
      const transactionArgs = vi.mocked(mockDb.$transaction).mock.calls[0][0] as unknown[];
      expect(Array.isArray(transactionArgs)).toBe(true);
      expect(transactionArgs).toHaveLength(2);
    });

    it('includes deleteMany with userId and create with entity data in the transaction', async () => {
      const entity = makeEntity({ userId: 'user-42' });

      let capturedDeleteMany: unknown;
      let capturedCreate: unknown;

      vi.mocked(mockDb.emailVerificationToken.deleteMany).mockImplementation((args) => {
        capturedDeleteMany = args;
        return { count: 0 } as never;
      });

      vi.mocked(mockDb.emailVerificationToken.create).mockImplementation((args) => {
        capturedCreate = args;
        return makeRow(entity) as never;
      });

      vi.mocked(mockDb.$transaction).mockImplementation(async (ops) => {
        if (Array.isArray(ops)) {
          return ops;
        }
        return [];
      });

      await adapter.save(entity);

      expect(mockDb.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-42' },
      });
      expect(mockDb.emailVerificationToken.create).toHaveBeenCalledWith({
        data: {
          id: entity.id,
          userId: entity.userId,
          tokenHash: entity.tokenHash,
          type: entity.type,
          expiresAt: entity.expiresAt,
          usedAt: entity.usedAt,
        },
      });

      expect(capturedDeleteMany).toBeDefined();
      expect(capturedCreate).toBeDefined();
    });
  });

  describe('delete', () => {
    it('calls deleteMany with the correct userId', async () => {
      vi.mocked(mockDb.emailVerificationToken.deleteMany).mockResolvedValue({ count: 1 } as never);

      await adapter.delete('user-99');

      expect(mockDb.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-99' },
      });
    });
  });
});
