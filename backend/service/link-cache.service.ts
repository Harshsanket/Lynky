import { env } from "../src/config/env.js";
import { getCacheStore } from "./redis.client.js";

export interface CachedLink {
  originalUrl: string;
  expiresAt: Date;
}

const linkKey = (code: string): string => `link:${code}`;
const hotKey = (code: string): string => `hot:${code}`;
const windowKey = (code: string, bucket: number): string =>
  `win:${code}:${bucket}`;

/** Raw Redis key for a cached link; used by the redirect preflight pipeline. */
export const cachedLinkKey = (code: string): string => linkKey(code);

const ttlFor = (expiresAt: Date, maxSeconds: number): number => {
  const remainingSeconds = Math.ceil(
    (expiresAt.getTime() - Date.now()) / 1000
  );

  return Math.max(0, Math.min(maxSeconds, remainingSeconds));
};

export const parseCachedLink = (
  raw: string | null
): CachedLink | null => {
  if (!raw) {
    return null;
  }

  let parsed: {
    originalUrl?: unknown;
    expiresAt?: unknown;
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }

  if (
    typeof parsed.originalUrl !== "string" ||
    typeof parsed.expiresAt !== "string"
  ) {
    return null;
  }

  const expiresAt = new Date(parsed.expiresAt);

  if (!Number.isFinite(expiresAt.getTime())) {
    return null;
  }

  if (expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return { originalUrl: parsed.originalUrl, expiresAt };
};

export const getCachedLink = async (
  code: string
): Promise<CachedLink | null> => {
  try {
    const raw = await getCacheStore().get(linkKey(code));
    const parsed = parseCachedLink(raw);

    if (raw && !parsed) {
      await getCacheStore().del(linkKey(code));
    }

    return parsed;
  } catch {
    return null;
  }
};

export const setCachedLink = async (
  code: string,
  link: CachedLink
): Promise<void> => {
  const ttl = ttlFor(link.expiresAt, env.HOT_CACHE_TTL_SECONDS);

  if (ttl <= 0) {
    return;
  }

  try {
    await getCacheStore().set(
      linkKey(code),
      JSON.stringify({
        originalUrl: link.originalUrl,
        expiresAt: link.expiresAt.toISOString(),
      }),
      ttl
    );
  } catch {
    // Cache failure must never fail a redirect.
  }
};

export const slideCachedLink = async (
  code: string,
  expiresAt: Date
): Promise<void> => {
  const ttl = ttlFor(expiresAt, env.HOT_CACHE_TTL_SECONDS);

  if (ttl <= 0) {
    await invalidateLinkCache(code);
    return;
  }

  try {
    await getCacheStore().pipeline([
      { type: "expire", key: linkKey(code), ttlSeconds: ttl },
      { type: "expire", key: hotKey(code), ttlSeconds: ttl },
      {
        type: "hSet",
        key: hotKey(code),
        field: "lastVisitedAt",
        value: new Date().toISOString(),
      },
    ]);
  } catch {
    // Ignore cache failures.
  }
};

export const invalidateLinkCache = async (
  code: string,
  options: { throwOnError?: boolean } = {}
): Promise<void> => {
  try {
    await getCacheStore().pipeline([
      { type: "del", key: linkKey(code) },
      { type: "del", key: hotKey(code) },
    ]);
  } catch (error) {
    if (options.throwOnError) {
      throw error;
    }
    // Redirects and rotations ignore cache failures; background callers can
    // opt into structured failure logging.
  }
};

/**
 * Fixed 5-minute buckets: current + previous approximate a sliding window
 * without storing per-request timestamps.
 */
export const recordVisitWindow = async (code: string): Promise<number> => {
  try {
    const store = getCacheStore();
    const bucket = Math.floor(Date.now() / (env.HOT_WINDOW_SECONDS * 1000));
    const currentKey = windowKey(code, bucket);
    const previousKey = windowKey(code, bucket - 1);

    const [current, previousRaw] = await Promise.all([
      store.incrBy(
        currentKey,
        1,
        env.HOT_WINDOW_SECONDS * 2
      ),
      store.get(previousKey),
    ]);

    const previous = Number(previousRaw ?? 0);

    return current + (Number.isFinite(previous) ? previous : 0);
  } catch {
    return 0;
  }
};

export const markHotLink = async (
  code: string,
  expiresAt: Date
): Promise<void> => {
  const ttl = ttlFor(expiresAt, env.HOT_CACHE_TTL_SECONDS);

  if (ttl <= 0) {
    return;
  }

  try {
    const now = new Date().toISOString();

    await getCacheStore().pipeline([
      {
        type: "hSet",
        key: hotKey(code),
        field: "startedAt",
        value: now,
      },
      {
        type: "hSet",
        key: hotKey(code),
        field: "lastVisitedAt",
        value: now,
      },
      { type: "expire", key: hotKey(code), ttlSeconds: ttl },
    ]);
  } catch {
    // Ignore cache failures.
  }
};
