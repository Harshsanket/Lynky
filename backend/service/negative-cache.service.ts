const NEGATIVE_TTL_MS = 30_000;
const MAX_ENTRIES = 10_000;

const negative = new Map<string, number>();

const purgeExpired = (now: number): void => {
  for (const [code, expiresAt] of negative) {
    if (expiresAt <= now) {
      negative.delete(code);
    }
  }
};

export const isNegativelyCached = (code: string): boolean => {
  const now = Date.now();
  const expiresAt = negative.get(code);

  if (expiresAt === undefined) {
    return false;
  }

  if (expiresAt <= now) {
    negative.delete(code);
    return false;
  }

  return true;
};

export const markNegative = (code: string): void => {
  const now = Date.now();

  if (negative.size >= MAX_ENTRIES) {
    purgeExpired(now);

    if (negative.size >= MAX_ENTRIES) {
      const oldest = negative.keys().next().value;

      if (oldest !== undefined) {
        negative.delete(oldest);
      }
    }
  }

  negative.set(code, now + NEGATIVE_TTL_MS);
};

export const clearNegative = (code: string): void => {
  negative.delete(code);
};

export const clearNegativeCacheForTests = (): void => {
  negative.clear();
};
