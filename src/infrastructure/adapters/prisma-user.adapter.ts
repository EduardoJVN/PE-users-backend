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

  async findByGoogleId(googleId: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { googleId } });
    return row ? toEntity(row) : null;
  }

  async save(entity: User): Promise<void> {
    await this.db.user.create({
      data: {
        id: entity.id,
        email: entity.email,
        password: entity.password,
        name: entity.name,
        lastName: entity.lastName,
        avatarUrl: entity.avatarUrl,
        statusId: entity.statusId,
        roleId: entity.roleId,
        registerTypeId: entity.registerTypeId,
        googleId: entity.googleId,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
    });
  }

  async update(entity: User): Promise<void> {
    await this.db.user.update({
      where: { id: entity.id },
      data: {
        email: entity.email,
        password: entity.password,
        name: entity.name,
        lastName: entity.lastName,
        avatarUrl: entity.avatarUrl,
        statusId: entity.statusId,
        roleId: entity.roleId,
        registerTypeId: entity.registerTypeId,
        googleId: entity.googleId,
        isActive: entity.isActive,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
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
  password: string | null;
  name: string;
  lastName: string;
  avatarUrl: string | null;
  statusId: number;
  roleId: number;
  registerTypeId: number;
  googleId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): User {
  return User.reconstitute(
    row.id,
    row.email,
    row.password,
    row.name,
    row.lastName,
    row.avatarUrl,
    row.statusId,
    row.roleId,
    row.registerTypeId,
    row.googleId,
    row.isActive,
    row.createdAt,
    row.updatedAt,
    row.deletedAt,
  );
}
