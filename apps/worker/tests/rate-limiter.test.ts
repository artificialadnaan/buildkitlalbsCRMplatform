import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/lib/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows requests within the limit', async () => {
    const limiter = new RateLimiter(5, 1000); // 5 per second
    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200); // all 5 should fire immediately
  });

  it('throttles requests that exceed the limit', async () => {
    const limiter = new RateLimiter(2, 1000); // 2 per second
    const start = Date.now();

    for (let i = 0; i < 3; i++) {
      await limiter.acquire();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(400); // 3rd request must wait ~500ms
  });

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter(2, 500); // 2 per 500ms
    await limiter.acquire();
    await limiter.acquire();
    // Both tokens consumed

    // Wait for refill
    await new Promise(r => setTimeout(r, 600));

    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // should be immediate after refill
  });
});
