import { waitUntil } from "@vercel/functions";
import { logError } from "../../service/logger.js";

/**
 * Background delivery for best-effort create-path side effects.
 *
 * On Vercel, `waitUntil` keeps the function alive after the response. Local
 * Express/test runs fall back to a tracked in-process promise (tests can await
 * `flushBackgroundTasksForTests`). Every task has bounded retries and a
 * structured final failure log; nothing here may affect the response.
 */

export interface BackgroundTaskOptions {
  /** Structured event name, e.g. `stats_increment_failed`. */
  event: string;
  /** Stable error code for logs/dashboards. */
  errorCode?: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  context?: Record<string, unknown>;
}

const inFlight = new Set<Promise<void>>();

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const execute = async (
  task: () => Promise<unknown> | unknown,
  options: BackgroundTaskOptions
): Promise<void> => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 50);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && retryDelayMs > 0) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  logError(options.event, lastError, {
    errorCode: options.errorCode ?? options.event,
    attempts: maxAttempts,
    ...(options.context ?? {}),
  });
};

/**
 * Run a best-effort task after the response. Returns immediately; the task is
 * retained by `waitUntil` when available, otherwise by the in-process set.
 */
export const runInBackground = (
  task: () => Promise<unknown> | unknown,
  options: BackgroundTaskOptions
): void => {
  const promise = execute(task, options).finally(() => {
    inFlight.delete(promise);
  });

  inFlight.add(promise);

  try {
    waitUntil(promise);
  } catch {
    // Local/Express or an incompatible runtime: the tracked promise still
    // runs while the process is alive.
  }
};

/** Test helper: wait for all currently scheduled background work. */
export const flushBackgroundTasksForTests = async (): Promise<void> => {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight]);
  }
};

export const backgroundTaskCountForTests = (): number => inFlight.size;
