/**
 * Promise.race with guaranteed timer cleanup on success and failure (PR-020).
 * @see WANT-027, docs/SPEC/11_FailureManager_Spec.md
 */

/** Races `promise` against a timer; passes through when `ms` is missing or non-positive. */
export async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutReject: string | Error = "Operation timed out"
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return promise;
  }
  const onTimeout = (): Error =>
    timeoutReject instanceof Error ? timeoutReject : new Error(timeoutReject);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
