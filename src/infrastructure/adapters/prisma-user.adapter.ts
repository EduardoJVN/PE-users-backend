import type { PrismaClient } from '@prisma/client';
import { User } from '@domain/user/entities/user.entity.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';

export class PrismaUserAdapter implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(): Promise<User[]> {
    const rows = await this.db.user.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toEntity(row) : null;
  }

  async save(entity: User): Promise<void> {
    await this.db.user.create({
      data: {
        id: entity.id,
        email: entity.email,
        passwordHash: entity.passwordHash,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
    });
  }

  async update(entity: User): Promise<void> {
    await this.db.user.update({
      where: { id: entity.id },
      data: {
        email: entity.email,
        passwordHash: entity.passwordHash,
        updatedAt: entity.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.user.delete({ where: { id } });
  }
}

function toEntity(row: {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return User.reconstitute(row.id, row.email, row.passwordHash, row.createdAt, row.updatedAt);
}
