import { RefreshToken } from '@domain/auth/entities/refresh-token.entity.js';
import type { IRefreshTokenRepository } from '@domain/auth/ports/refresh-token.repository.port.js';

export class InMemoryRefreshTokenAdapter implements IRefreshTokenRepository {
  private readonly store: Map<string, RefreshToken> = new Map();

  async findAll(): Promise<RefreshToken[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.store.get(id) ?? null;
  }

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    for (const token of this.store.values()) {
      if (token.tokenHash === hash) return token;
    }
    return null;
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const result: RefreshToken[] = [];
    for (const token of this.store.values()) {
      if (token.userId === userId) {
        result.push(token);
      }
    }
    return result;
  }

  async save(entity: RefreshToken): Promise<void> {
    if (this.store.has(entity.id)) {
      throw new Error(`RefreshToken with id '${entity.id}' already exists`);
    }
    this.store.set(entity.id, entity);
  }

  async update(entity: RefreshToken): Promise<void> {
    if (!this.store.has(entity.id)) {
      throw new Error(`RefreshToken with id '${entity.id}' does not exist`);
    }
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [id, token] of this.store.entries()) {
      if (token.userId === userId) {
        this.store.delete(id);
      }
    }
  }
}
