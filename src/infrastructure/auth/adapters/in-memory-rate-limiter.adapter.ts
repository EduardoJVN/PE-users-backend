import type { IRateLimiter } from '@domain/ports/rate-limiter.port.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class InMemoryRateLimiterAdapter implements IRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();

  async checkAndIncrement(key: string, windowMs: number, maxAttempts: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= maxAttempts) {
      return false;
    }

    entry.count += 1;
    return true;
  }
}
