import { User } from '@domain/user/entities/user.entity.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';

export class InMemoryUserAdapter implements IUserRepository {
  private readonly store: Map<string, User> = new Map();

  async findAll(): Promise<User[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.googleId === googleId) {
        return user;
      }
    }
    return null;
  }

  async save(entity: User): Promise<void> {
    if (this.store.has(entity.id)) {
      throw new Error(`User with id '${entity.id}' already exists`);
    }
    this.store.set(entity.id, entity);
  }

  async update(entity: User): Promise<void> {
    if (!this.store.has(entity.id)) {
      throw new Error(`User with id '${entity.id}' does not exist`);
    }
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
