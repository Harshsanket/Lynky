import { env } from "../src/config/env.js";
import { Link } from "../models/link.models.js";
import { Stats } from "../models/stats.models.js";
import { hashCode } from "./code-hash.service.js";
import { pendingCodeKey, pendingGlobalKey } from "./click-keys.js";
import { getCacheStore } from "./redis.client.js";
import { invalidateStatsCache } from "./stats.service.js";

interface PendingCounts {
  attempts: number;
  success: number;
  failed: number;
  startedAt: string | null;
}

const FIELDS = ["attempts", "success", "failed", "startedAt"] as const;

const readPending = async (key: string): Promise<PendingCounts> => {
  const values = await getCacheStore().hGetAll(key);

  return {
    attempts: Number(values.attempts ?? 0) || 0,
    success: Number(values.success ?? 0) || 0,
    failed: Number(values.failed ?? 0) || 0,
    startedAt: values.startedAt ?? null,
  };
};

const bumpPending = async (
  key: string,
  success: boolean
): Promise<PendingCounts> => {
  const store = getCacheStore();
  const now = new Date().toISOString();
  const existing = await readPending(key);

  if (!existing.startedAt) {
    await store.hSet(key, "startedAt", now);
  }

  await store.hIncrBy(key, "attempts", 1);
  await store.hIncrBy(key, success ? "success" : "failed", 1);
  await store.expire(key, env.CLICK_PENDING_TTL_SECONDS);

  return {
    attempts: existing.attempts + 1,
    success: existing.success + (success ? 1 : 0),
    failed: existing.failed + (success ? 0 : 1),
    startedAt: existing.startedAt ?? now,
  };
};

const shouldFlush = (pending: PendingCounts): boolean => {
  if (pending.attempts <= 0) {
    return false;
  }

  if (pending.attempts >= env.CLICK_FLUSH_EVERY_N) {
    return true;
  }

  if (!pending.startedAt) {
    return false;
  }

  const startedAt = Date.parse(pending.startedAt);

  return (
    Number.isFinite(startedAt) &&
    Date.now() - startedAt >= env.CLICK_FLUSH_INTERVAL_MS
  );
};

const writeExactClick = async (
  code: string,
  success: boolean
): Promise<void> => {
  const statsUpdate = {
    totalClicksAttempts: 1,
    ...(success
      ? {
          totalClicksSuccess: 1,
          totalRedirects: 1,
        }
      : { totalClicksFailed: 1 }),
  };

  await Stats.findOneAndUpdate(
    { key: "global" },
    { $inc: statsUpdate },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (success) {
    await Link.updateOne(
      { codeHash: hashCode(code) },
      {
        $inc: { visitCount: 1 },
        $set: { lastVisitedAt: new Date() },
      }
    );
  }

  invalidateStatsCache();
};

/**
 * Flush one code's unflushed successful visits to its Link row. Attempts and
 * failures live only in the global pending counter (they have no Link row).
 */
export const flushClickForCode = async (code: string): Promise<void> => {
  const key = pendingCodeKey(code);
  const pending = await readPending(key);

  if (pending.attempts <= 0) {
    return;
  }

  await getCacheStore().hDel(key, ...FIELDS);

  if (pending.success > 0) {
    await Link.updateOne(
      { codeHash: hashCode(code) },
      {
        $inc: { visitCount: pending.success },
        $set: { lastVisitedAt: new Date() },
      }
    );
  }
};

/**
 * Flush the global click counters. Safe to call on every request: it only
 * writes Mongo when there is a non-empty pending bucket.
 */
export const flushGlobalClicks = async (): Promise<void> => {
  const key = pendingGlobalKey;
  const pending = await readPending(key);

  if (pending.attempts <= 0) {
    return;
  }

  await getCacheStore().hDel(key, ...FIELDS);

  await Stats.findOneAndUpdate(
    { key: "global" },
    {
      $inc: {
        totalClicksAttempts: pending.attempts,
        totalClicksSuccess: pending.success,
        totalClicksFailed: pending.failed,
        totalRedirects: pending.success,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  invalidateStatsCache();
};

const exactModeForCurrentTraffic = async (): Promise<boolean> => {
  if (env.CLICK_STORAGE_MODE === "exact") {
    return true;
  }

  if (env.CLICK_STORAGE_MODE !== "dynamic") {
    return false;
  }

  try {
    const hour = Math.floor(Date.now() / 3_600_000);
    const count = Number(
      (await getCacheStore().get(`rl:global:${hour}`)) ?? 0
    );

    return (
      !Number.isFinite(count) ||
      count < env.CLICK_EXACT_BELOW_PER_HOUR
    );
  } catch {
    return true;
  }
};

/**
 * Exposed for tests and diagnostics: choose exact write-through vs buffered
 * storage for the current traffic level.
 */
export const resolveClickStorageMode = async (): Promise<
  "exact" | "hybrid"
> => ((await exactModeForCurrentTraffic()) ? "exact" : "hybrid");

/**
 * Record one redirect attempt. Exact mode writes Mongo immediately; hybrid and
 * dynamic modes buffer in Redis and flush in batches from the request path.
 * Never throws: a counting failure must not break a redirect.
 */
export interface RecordClickOptions {
  /**
   * Cold-path visits write the per-link counter through immediately (per §13),
   * while global attempts still use the Redis pending buffer. Hot hits use the
   * per-code pending buffer.
   */
  writeLinkNow?: boolean;
}

export const recordClick = async (
  code: string,
  success: boolean,
  options: RecordClickOptions = {}
): Promise<void> => {
  try {
    if (await exactModeForCurrentTraffic()) {
      await writeExactClick(code, success);
      return;
    }

    if (success && options.writeLinkNow) {
      await Link.updateOne(
        { codeHash: hashCode(code) },
        {
          $inc: { visitCount: 1 },
          $set: { lastVisitedAt: new Date() },
        }
      );
    } else if (success) {
      const codePending = await bumpPending(pendingCodeKey(code), true);

      if (shouldFlush(codePending)) {
        await flushClickForCode(code);
      }
    }

    const globalPending = await bumpPending(pendingGlobalKey, success);

    if (shouldFlush(globalPending)) {
      await flushGlobalClicks();
    }
  } catch {
    // Counting is best-effort; redirects must continue.
  }
};

/** Flush everything on a request path (used by redirects and tests). */
export const flushPendingClicks = async (code?: string): Promise<void> => {
  await flushGlobalClicks();

  if (code) {
    await flushClickForCode(code);
  }
};
