import { logger } from './logger';

interface WithRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  tag?: string;
}

/**
 * Retry an async function with exponential backoff.
 * On final failure: logs via logger.error and returns undefined (does not throw).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T | undefined> {
  const { maxAttempts = 3, delayMs = 1000, tag = 'withRetry' } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        logger.error(tag, `Failed after ${maxAttempts} attempts`, error);
        return undefined;
      }

      const delay = delayMs * Math.pow(2, attempt);
      logger.warn(tag, `Attempt ${attempt + 1} failed, retrying in ${delay}ms`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return undefined;
}
