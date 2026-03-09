/**
 * Retry utility with exponential backoff for transient failures.
 * L2-06: Production retry logic for external service calls.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Optional predicate to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

export const DefaultRetryOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Check if an error represents a transient failure that should be retried.
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    message.includes("network error") ||
    message.includes("temporarily unavailable") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

/**
 * Execute an operation with retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DefaultRetryOptions, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if we should retry this error
      if (opts.isRetryable && !opts.isRetryable(lastError)) {
        throw lastError;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Operation failed after all retry attempts");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration for different service types.
 */
export const RetryConfigs = {
  /** Vector store operations */
  vectorStore: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    isRetryable: isTransientError,
  } as RetryOptions,

  /** Model provider API calls */
  modelProvider: {
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    isRetryable: isTransientError,
  } as RetryOptions,

  /** Tool gateway operations */
  toolGateway: {
    maxAttempts: 2,
    initialDelayMs: 250,
    maxDelayMs: 3000,
    backoffMultiplier: 1.5,
    isRetryable: isTransientError,
  } as RetryOptions,
};
