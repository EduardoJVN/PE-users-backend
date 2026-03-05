import type { PrismaClient } from '@prisma/client';
import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';

export class PrismaRefreshTokenAdapter implements IRefreshTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(): Promise<RefreshToken[]> {
    const rows = await this.db.refreshToken.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<RefreshToken | null> {
    const row = await this.db.refreshToken.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    const row = await this.db.refreshToken.findFirst({ where: { tokenHash: hash } });
    return row ? toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const rows = await this.db.refreshToken.findMany({ where: { userId } });
    return rows.map(toEntity);
  }

  async save(entity: RefreshToken): Promise<void> {
    await this.db.refreshToken.create({
      data: {
        id: entity.id,
        userId: entity.userId,
        tokenHash: entity.tokenHash,
        expiresAt: entity.expiresAt,
        usedAt: entity.usedAt,
        createdAt: entity.createdAt,
      },
    });
  }

  async update(entity: RefreshToken): Promise<void> {
    await this.db.refreshToken.update({
      where: { id: entity.id },
      data: { usedAt: entity.usedAt },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.refreshToken.delete({ where: { id } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId } });
  }
}

function toEntity(row: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}): RefreshToken {
  return RefreshToken.reconstitute(
    row.id,
    row.userId,
    row.tokenHash,
    row.expiresAt,
    row.usedAt,
    row.createdAt,
  );
}
