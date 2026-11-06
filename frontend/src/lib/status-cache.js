/**
 * Module-level status/stats cache shared by ServerStatus and LinkCounter.
 *
 * A home visit should make at most one `/status` request; StrictMode remounts,
 * refresh events, and sibling components share the in-flight promise and the
 * 30-second TTL. A sessionStorage copy lets a hard refresh render immediately.
 */

const STORAGE_KEY = "lynky:status-cache";
const DEFAULT_TTL_MS = 30_000;
const REFRESH_THROTTLE_MS = 30_000;

const defaultStorage = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const readStored = (storage) => {
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStored = (storage, entry) => {
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable/private; the memory copy still works.
  }
};

export const createStatusCache = ({
  load,
  ttlMs = DEFAULT_TTL_MS,
  storage = defaultStorage(),
  now = () => Date.now(),
} = {}) => {
  let memory = null;
  let inflight = null;
  let lastLoadAt = 0;

  const fresh = (entry) =>
    Boolean(entry) && entry.expiresAt > now();

  const get = async ({ force = false } = {}) => {
    if (!force && fresh(memory)) {
      return memory.value;
    }

    if (!force && !memory) {
      const stored = readStored(storage);

      if (fresh(stored)) {
        memory = stored;
        return stored.value;
      }
    }

    if (inflight) {
      return inflight;
    }

    const previous = memory ?? readStored(storage);

    lastLoadAt = now();

    inflight = Promise.resolve()
      .then(load)
      .then((value) => {
        const entry = {
          value,
          expiresAt: now() + ttlMs,
        };

        memory = entry;
        writeStored(storage, entry);

        return value;
      })
      .catch((error) => {
        if (previous?.value) {
          return { ...previous.value, stale: true };
        }

        throw error;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  };

  const refresh = async () => {
    if (now() - lastLoadAt < REFRESH_THROTTLE_MS) {
      return memory?.value ?? null;
    }

    return get({ force: true });
  };

  const clear = () => {
    memory = null;
    inflight = null;
    lastLoadAt = 0;

    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  return { get, refresh, clear };
};

const defaultLoader = async () => {
  const { fetchBackendStatus } = await import("../api/status.api");

  return fetchBackendStatus();
};

export const statusCache = createStatusCache({
  load: defaultLoader,
});

export const getStatus = (options) => statusCache.get(options);
export const refreshStatus = () => statusCache.refresh();
export const clearStatusCache = () => statusCache.clear();
