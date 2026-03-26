/**
 * Shared async deadline race for orchestrated pipelines (query handler, chat pipeline, etc.).
 * @see WANT-004 — single primitive for plan `deadline_ms` enforcement.
 */

export class RequestDeadlineExceededError extends Error {
  constructor(public readonly deadlineMs: number) {
    super(`Request deadline exceeded after ${deadlineMs}ms`);
    this.name = "RequestDeadlineExceededError";
  }
}

/** Races `promise` against a timer; no-op when `deadlineMs` is missing or non-positive. */
export async function withDeadline<T>(promise: Promise<T>, deadlineMs?: number): Promise<T> {
  if (!deadlineMs || deadlineMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RequestDeadlineExceededError(deadlineMs));
        }, deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
