import { describe, it, expect, beforeEach } from 'vitest';
import { BcryptPasswordHasherAdapter } from '@infra/auth/adapters/bcrypt-password-hasher.adapter.js';

describe('BcryptPasswordHasherAdapter', () => {
  let adapter: BcryptPasswordHasherAdapter;

  beforeEach(() => {
    // Use saltRounds=1 for speed in tests
    adapter = new BcryptPasswordHasherAdapter(1);
  });

  describe('hash', () => {
    it('returns a string different from the plain input', async () => {
      const plain = 'my-secret-password';
      const hashed = await adapter.hash(plain);

      expect(hashed).not.toBe(plain);
      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('produces different hashes for the same input on repeated calls (salted)', async () => {
      const plain = 'my-secret-password';
      const hash1 = await adapter.hash(plain);
      const hash2 = await adapter.hash(plain);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compare', () => {
    it('returns true when plain text matches the hash', async () => {
      const plain = 'correct-password';
      const hash = await adapter.hash(plain);

      const result = await adapter.compare(plain, hash);
      expect(result).toBe(true);
    });

    it('returns false when plain text does not match the hash', async () => {
      const hash = await adapter.hash('correct-password');

      const result = await adapter.compare('wrong-password', hash);
      expect(result).toBe(false);
    });
  });
});
