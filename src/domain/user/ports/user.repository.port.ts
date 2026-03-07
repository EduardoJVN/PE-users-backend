import type { User } from '@domain/user/entities/user.entity.js';

export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  save(entity: User): Promise<void>;
  update(entity: User): Promise<void>;
  delete(id: string): Promise<void>;
}
