import type { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';

export interface IRefreshTokenRepository {
  findAll(): Promise<RefreshToken[]>;
  findById(id: string): Promise<RefreshToken | null>;
  findByTokenHash(hash: string): Promise<RefreshToken | null>;
  findByUserId(userId: string): Promise<RefreshToken[]>;
  save(entity: RefreshToken): Promise<void>;
  update(entity: RefreshToken): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
