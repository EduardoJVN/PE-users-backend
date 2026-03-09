import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryRateLimiterAdapter } from '@infra/auth/adapters/in-memory-rate-limiter.adapter.js';

describe('InMemoryRateLimiterAdapter', () => {
  let adapter: InMemoryRateLimiterAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = new InMemoryRateLimiterAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for the first attempt', async () => {
    const result = await adapter.checkAndIncrement('key:user-1', 60_000, 3);
    expect(result).toBe(true);
  });

  it('returns true for attempts within the limit (2nd and 3rd out of max 3)', async () => {
    await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 1st
    const second = await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 2nd
    const third = await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 3rd

    expect(second).toBe(true);
    expect(third).toBe(true);
  });

  it('returns false when maxAttempts is exceeded (4th attempt with max=3)', async () => {
    await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 1st
    await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 2nd
    await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 3rd

    const fourth = await adapter.checkAndIncrement('key:user-1', 60_000, 3); // 4th — exceeds
    expect(fourth).toBe(false);
  });

  it('returns true after the window resets', async () => {
    await adapter.checkAndIncrement('key:user-1', 60_000, 3);
    await adapter.checkAndIncrement('key:user-1', 60_000, 3);
    await adapter.checkAndIncrement('key:user-1', 60_000, 3);

    // Advance time past the window
    vi.advanceTimersByTime(60_001);

    const afterReset = await adapter.checkAndIncrement('key:user-1', 60_000, 3);
    expect(afterReset).toBe(true);
  });

  it('tracks different keys independently', async () => {
    await adapter.checkAndIncrement('key:user-1', 60_000, 1); // hits max for user-1

    const user1Blocked = await adapter.checkAndIncrement('key:user-1', 60_000, 1);
    const user2First = await adapter.checkAndIncrement('key:user-2', 60_000, 1);

    expect(user1Blocked).toBe(false);
    expect(user2First).toBe(true);
  });

  it('does not increment counter when rate limit is already exceeded', async () => {
    const windowMs = 60_000;
    const maxAttempts = 2;

    await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts); // count → 1
    await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts); // count → 2
    await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts); // blocked, count stays at 2
    await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts); // blocked, count stays at 2

    // Advance to just before window expires — should still be blocked
    vi.advanceTimersByTime(windowMs - 1);

    const stillBlocked = await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts);
    expect(stillBlocked).toBe(false);

    // Advance past window — new window starts, count resets to 1
    vi.advanceTimersByTime(2);

    const afterReset = await adapter.checkAndIncrement('key:user-1', windowMs, maxAttempts);
    expect(afterReset).toBe(true);
  });
});
