import bcrypt from 'bcrypt';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';

export class BcryptPasswordHasherAdapter implements IPasswordHasher {
  constructor(private readonly saltRounds: number = 12) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
