export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillIntervalMs: number;
  private lastRefillTime: number;

  constructor(maxRequestsPerWindow: number, windowMs: number) {
    this.maxTokens = maxRequestsPerWindow;
    this.tokens = maxRequestsPerWindow;
    this.refillIntervalMs = windowMs;
    this.lastRefillTime = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor((elapsed / this.refillIntervalMs) * this.maxTokens);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait for the next token
    const waitTime = Math.ceil(this.refillIntervalMs / this.maxTokens);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.refill();
    this.tokens--;
  }
}
