
/**
 * Rate Limiter for API requests and token usage
 * Prevents exceeding Anthropic API rate limits.
 *
 * Implements a token bucket algorithm with a sliding window.
 */

export interface RateLimiterConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;

  /** Maximum tokens per minute */
  maxTokensPerMinute: number;

  /** Maximum concurrent requests */
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100000,
  maxConcurrent: 5
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private activeRequests = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };

    if (
      this.config.maxRequestsPerMinute <= 0 ||
      this.config.maxTokensPerMinute <= 0 ||
      this.config.maxConcurrent <= 0
    ) {
      throw new Error('Rate limit values must be positive');
    }
  }

  /**
   * Acquire permission to make an API request.
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    if (!Number.isFinite(estimatedTokens) || estimatedTokens < 0) {
      throw new Error('estimatedTokens must be a non-negative number');
    }

    if (estimatedTokens > this.config.maxTokensPerMinute) {
      throw new Error('Estimated tokens exceed the maximum token limit');
    }

    while (true) {
      // Wait for a concurrent request slot.
      while (this.activeRequests >= this.config.maxConcurrent) {
        await this.waitForSlot();
      }

      // Wait until request and token limits allow execution.
      await this.waitForRateLimit(estimatedTokens);

      // Recheck concurrency and rate limits before reserving.
      if (
        this.activeRequests < this.config.maxConcurrent &&
        this.canProceed(estimatedTokens)
      ) {
        this.activeRequests++;

        this.requestHistory.push({
          timestamp: Date.now(),
          tokens: estimatedTokens
        });

        return;
      }
    }
  }

  /**
   * Release a request slot after completion.
   */
  release(actualTokens?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    // Wake the next waiting request.
    const next = this.waitQueue.shift();

    if (next) {
      next();
    }
  }

  /**
   * Get current rate limit status.
   */
  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    return {
      activeRequests: this.activeRequests,
      requestsInWindow,
      tokensInWindow,
      availableRequests: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInWindow
      ),
      availableTokens: Math.max(
        0,
        this.config.maxTokensPerMinute - tokensInWindow
      )
    };
  }

  /**
   * Check whether a request can proceed immediately.
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    return (
      this.activeRequests < this.config.maxConcurrent &&
      requestsInWindow < this.config.maxRequestsPerMinute &&
      tokensInWindow + estimatedTokens <=
        this.config.maxTokensPerMinute
    );
  }

  /**
   * Wait for a concurrent request slot.
   */
  private async waitForSlot(): Promise<void> {
    await new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Wait until sliding-window rate limits allow execution.
   */
  private async waitForRateLimit(
    estimatedTokens: number
  ): Promise<void> {
    while (!this.canProceed(estimatedTokens)) {
      this.pruneOldRecords();

      if (this.requestHistory.length === 0) {
        // No previous requests remain in the window.
        // If the request still cannot proceed, it cannot fit
        // within the configured limits.
        throw new Error(
          'Request cannot proceed within the configured rate limits'
        );
      }

      const oldestRecord = this.requestHistory[0];

      if (!oldestRecord) {
        break;
      }

      const oldestTimestamp = oldestRecord.timestamp;

      const expirationTime = oldestTimestamp + 60000;

      const remainingTime = expirationTime - Date.now() + 100;

      const waitTime = Math.min(
        5000,
        Math.max(100, remainingTime)
      );

      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  /**
   * Remove request records older than 60 seconds.
   */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - 60000;

    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp > cutoff
    );
  }
}

/**
 * Wrap an async operation with rate limiting.
 */
export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000
): Promise<T> {
  await rateLimiter.acquire(estimatedTokens);

  try {
    return await fn();
  } finally {
    rateLimiter.release();
  }
}

/**
 * Global rate limiter instance.
 */
export const globalRateLimiter = new RateLimiter();
