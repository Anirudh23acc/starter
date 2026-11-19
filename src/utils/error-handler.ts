
/**
 * Custom error class for review operations
 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';
    Error.captureStackTrace(this, ReviewError);
  }
}

/**
 * Error codes for the review system
 */
export const ErrorCodes = {
  // Configuration errors
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // GitHub errors
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Agent errors
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  // General errors
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Retry utility with exponential backoff and jitter
 *
 * maxRetries represents the number of retries after the initial attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error('maxRetries must be a non-negative integer');
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be a non-negative number');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Stop if all attempts have been exhausted
      if (attempt > maxRetries) {
        break;
      }

      // Exponential backoff: delayMs * 2^(attempt - 1)
      const backoff = delayMs * Math.pow(2, attempt - 1);

      // Add random jitter between 0 and 100 milliseconds
      const jitter = Math.random() * 100;

      const waitTime = backoff + jitter;

      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  throw new ReviewError(
    `Operation failed after ${maxRetries + 1} attempts: ${
      lastError instanceof Error
        ? lastError.message
        : String(lastError)
    }`,
    ErrorCodes.RETRY_EXHAUSTED,
    {
      attempts: maxRetries + 1,
      maxRetries,
      lastError:
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
    }
  );
}

/**
 * Wrap an async function with timeout
 *
 * Uses Promise.race() to return whichever completes first:
 * 1. The actual operation
 * 2. The timeout promise
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive number');
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new ReviewError(
            errorMessage,
            ErrorCodes.AGENT_TIMEOUT,
            { timeoutMs }
          )
        );
      }, timeoutMs);
    });

    return await Promise.race([
      fn(),
      timeoutPromise
    ]);

  } finally {
    // Clear timer when operation completes or times out
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Check if an error is a ReviewError
 */
export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Format error for logging/display
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
