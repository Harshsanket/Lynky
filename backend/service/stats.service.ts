import { Stats } from "../models/stats.models.js";
import { connectDatabase } from "../database/index.database.js";
import { getCacheStore } from "./redis.client.js";
import { pendingGlobalKey } from "./click-keys.js";
import { runInBackground } from "../src/utils/background.js";

/**
 * Public aggregate counters.
 *
 * A short-lived in-process cache with a single-flight promise keeps the home
 * page (and `/status`) from querying MongoDB on every visit. Redis holds only
 * unflushed deltas, never the authoritative totals.
 */
export interface StatsSnapshot {
  totalLinks: number;
  totalRedirects: number;
  totalClicksAttempts: number;
  totalClicksSuccess: number;
  totalClicksFailed: number;
  pendingRedirects: number;
  stale?: boolean;
}

const CACHE_TTL_MS = 30_000;

let cache: { value: StatsSnapshot; expiresAt: number } | null = null;
let inflight: Promise<StatsSnapshot> | null = null;

const readPendingGlobal = async (): Promise<number> => {
  try {
    const pending = await getCacheStore().hGetAll(pendingGlobalKey);
    const success = Number(pending.success ?? 0);

    return Number.isFinite(success) ? success : 0;
  } catch {
    return 0;
  }
};

const readStats = async (): Promise<StatsSnapshot> => {
  await connectDatabase();

  const stats = await Stats.findOne({ key: "global" }).lean();
  const pendingRedirects = await readPendingGlobal();

  return {
    totalLinks: stats?.totalLinks ?? 0,
    totalRedirects: stats?.totalRedirects ?? 0,
    totalClicksAttempts: stats?.totalClicksAttempts ?? 0,
    totalClicksSuccess: stats?.totalClicksSuccess ?? 0,
    totalClicksFailed: stats?.totalClicksFailed ?? 0,
    pendingRedirects,
  };
};

export const getStatsSnapshot = async (
  options: { force?: boolean } = {}
): Promise<StatsSnapshot> => {
  const now = Date.now();

  if (!options.force && cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (inflight) {
    return inflight;
  }

  inflight = readStats()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .catch((error) => {
      if (cache) {
        return { ...cache.value, stale: true };
      }

      throw error;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

export const invalidateStatsCache = (): void => {
  if (cache) {
    cache.expiresAt = 0;
  }
};

export const setCachedTotalLinks = (totalLinks: number): void => {
  if (cache) {
    cache = {
      value: { ...cache.value, totalLinks },
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }
};

const incrementOnce = async (amount: number) =>
  Stats.findOneAndUpdate(
    { key: "global" },
    {
      $inc: {
        totalLinks: amount,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  ).lean();

const incrementTotalLinksBy = async (
  amount: number
): Promise<number> => {
  try {
    const stats = await incrementOnce(amount);
    const totalLinks = stats?.totalLinks ?? 0;

    setCachedTotalLinks(totalLinks);

    return totalLinks;
  } catch (error: any) {
    // Two first-ever requests can race on the unique `key` index; retry once
    // now that the document exists.
    if (error?.code === 11000) {
      const stats = await incrementOnce(amount);
      const totalLinks = stats?.totalLinks ?? 0;

      setCachedTotalLinks(totalLinks);

      return totalLinks;
    }

    throw error;
  }
};

export const incrementTotalLinks = async (): Promise<number> =>
  incrementTotalLinksBy(1);

/*
 * Create-path side effects are delivered after the response. Bursts are
 * coalesced into a single Mongo `$inc` so background stats work does not
 * compete with the create path or issue one write per successful link.
 */
let pendingTotalLinks = 0;
let totalLinksFlushScheduled = false;
const TOTAL_LINKS_COALESCE_MS = 25;

const flushScheduledTotalLinks = async (): Promise<void> => {
  let succeeded = false;

  try {
    await new Promise((resolve) => {
      setTimeout(resolve, TOTAL_LINKS_COALESCE_MS);
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      const amount = pendingTotalLinks;
      pendingTotalLinks = 0;

      if (amount <= 0) {
        return;
      }

      try {
        await incrementTotalLinksBy(amount);
        succeeded = true;
        break;
      } catch (error) {
        // Put the amount back so a retry (or the next create) cannot lose it.
        pendingTotalLinks += amount;

        if (attempt === 3) {
          throw error;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 50 * attempt);
        });
      }
    }
  } finally {
    totalLinksFlushScheduled = false;
  }

  if (succeeded && pendingTotalLinks > 0) {
    scheduleTotalLinksFlush();
  }
};

const scheduleTotalLinksFlush = (): void => {
  if (totalLinksFlushScheduled) {
    return;
  }

  totalLinksFlushScheduled = true;

  runInBackground(flushScheduledTotalLinks, {
    event: "stats_increment_failed",
    errorCode: "stats_increment_failed",
    maxAttempts: 1,
    context: { operation: "scheduleTotalLinksIncrement" },
  });
};

export const scheduleTotalLinksIncrement = (): void => {
  pendingTotalLinks++;
  scheduleTotalLinksFlush();
};

/**
 * Read the current global counter through the cached snapshot.
 */
export const getTotalLinks = async (): Promise<number> => {
  const snapshot = await getStatsSnapshot();

  return snapshot.totalLinks;
};
