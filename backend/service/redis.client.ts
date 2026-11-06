import { Redis } from "ioredis";
import { env } from "../src/config/env.js";
import { logInfo, logWarn } from "./logger.js";

/**
 * Small cache-store contract shared by the Redis implementation and the
 * in-memory fallback. Redis is cache-only (Mongo remains the source of truth),
 * so every operation is allowed to fail and fall back without breaking a
 * request.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrBy(key: string, delta: number, ttlSeconds?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hIncrBy(key: string, field: string, delta: number): Promise<number>;
  hSet(key: string, field: string, value: string): Promise<void>;
  hDel(key: string, ...fields: string[]): Promise<void>;
  sAdd(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, member: string): Promise<void>;
}

interface MemoryEntry {
  expiresAt: number | null;
  value: string | Map<string, string> | Set<string>;
}

/**
 * Process-local fallback. It is used when Redis is not configured (local dev)
 * or temporarily unavailable. It intentionally behaves like a simple cache:
 * restarting the process loses pending deltas.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  private getEntry(key: string): MemoryEntry | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }

  private setEntry(
    key: string,
    value: MemoryEntry["value"],
    ttlSeconds?: number
  ): void {
    this.entries.set(key, {
      value,
      expiresAt:
        ttlSeconds === undefined
          ? null
          : Date.now() + ttlSeconds * 1000,
    });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.getEntry(key);

    return typeof entry?.value === "string" ? entry.value : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.setEntry(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async incrBy(
    key: string,
    delta: number,
    ttlSeconds?: number
  ): Promise<number> {
    const entry = this.getEntry(key);
    const current =
      typeof entry?.value === "string" ? Number(entry.value) : 0;
    const next = (Number.isFinite(current) ? current : 0) + delta;

    if (entry) {
      entry.value = String(next);
    } else {
      this.setEntry(key, String(next), ttlSeconds);
    }

    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.getEntry(key);

    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const entry = this.getEntry(key);

    if (!(entry?.value instanceof Map)) {
      return {};
    }

    return Object.fromEntries(entry.value);
  }

  async hIncrBy(
    key: string,
    field: string,
    delta: number
  ): Promise<number> {
    const entry = this.getEntry(key);
    let hash: Map<string, string>;

    if (entry?.value instanceof Map) {
      hash = entry.value;
    } else {
      hash = new Map();
      this.setEntry(key, hash);
    }

    const current = Number(hash.get(field) ?? 0);
    const next = (Number.isFinite(current) ? current : 0) + delta;

    hash.set(field, String(next));

    return next;
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    const entry = this.getEntry(key);
    let hash: Map<string, string>;

    if (entry?.value instanceof Map) {
      hash = entry.value;
    } else {
      hash = new Map();
      this.setEntry(key, hash);
    }

    hash.set(field, value);
  }

  async hDel(key: string, ...fields: string[]): Promise<void> {
    const entry = this.getEntry(key);

    if (!(entry?.value instanceof Map)) {
      return;
    }

    for (const field of fields) {
      entry.value.delete(field);
    }

    if (entry.value.size === 0) {
      this.entries.delete(key);
    }
  }

  async sAdd(key: string, member: string): Promise<void> {
    const entry = this.getEntry(key);
    let set: Set<string>;

    if (entry?.value instanceof Set) {
      set = entry.value;
    } else {
      set = new Set();
      this.setEntry(key, set);
    }

    set.add(member);
  }

  async sMembers(key: string): Promise<string[]> {
    const entry = this.getEntry(key);

    return entry?.value instanceof Set ? [...entry.value] : [];
  }

  async sRem(key: string, member: string): Promise<void> {
    const entry = this.getEntry(key);

    if (!(entry?.value instanceof Set)) {
      return;
    }

    entry.value.delete(member);

    if (entry.value.size === 0) {
      this.entries.delete(key);
    }
  }
}

const KEY_PREFIX =
  env.NODE_ENV === "test" ? "lynky:test:" : "lynky:";

const prefixed = (key: string): string => `${KEY_PREFIX}${key}`;

/**
 * Redis-backed store with a process-local fallback. A Redis error degrades the
 * store for 30 seconds so an outage does not add a timeout to every request.
 */
class ResilientCacheStore implements CacheStore {
  private readonly memory = new MemoryCacheStore();
  private readonly redis: Redis | null;
  private degradedUntil = 0;
  private lastErrorLogAt = 0;

  constructor() {
    if (!env.REDIS_URL) {
      this.redis = null;
      return;
    }

    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1000,
      commandTimeout: 100,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    this.redis.on("error", (error) => {
      const now = Date.now();

      if (now - this.lastErrorLogAt > 30_000) {
        this.lastErrorLogAt = now;
        logWarn("redis_unavailable", {
          errorCode: "redis_unavailable",
          message: (error as Error).message,
        });
      }
    });
  }

  private canUseRedis(): boolean {
    return (
      this.redis !== null &&
      Date.now() >= this.degradedUntil &&
      this.redis.status !== "end"
    );
  }

  private markDegraded(error: unknown): void {
    this.degradedUntil = Date.now() + 30_000;

    const now = Date.now();

    if (now - this.lastErrorLogAt > 30_000) {
      this.lastErrorLogAt = now;
      logWarn("redis_fallback", {
        errorCode: "redis_unavailable",
        message: (error as Error)?.message ?? String(error),
      });
    }
  }

  private async run<T>(
    operation: (client: Redis) => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (!this.canUseRedis()) {
      return fallback();
    }

    try {
      return await operation(this.redis as Redis);
    } catch (error) {
      this.markDegraded(error);
      return fallback();
    }
  }

  async get(key: string): Promise<string | null> {
    return this.run(
      (client) => client.get(prefixed(key)),
      () => this.memory.get(prefixed(key))
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.run(
      async (client) => {
        if (ttlSeconds === undefined) {
          await client.set(prefixed(key), value);
        } else {
          await client.set(prefixed(key), value, "EX", ttlSeconds);
        }
      },
      () => this.memory.set(prefixed(key), value, ttlSeconds)
    );
  }

  async del(key: string): Promise<void> {
    return this.run(
      (client) => client.del(prefixed(key)).then(() => undefined),
      () => this.memory.del(prefixed(key))
    );
  }

  async incrBy(
    key: string,
    delta: number,
    ttlSeconds?: number
  ): Promise<number> {
    return this.run(
      async (client) => {
        const value = await client.incrby(prefixed(key), delta);

        if (value === delta && ttlSeconds !== undefined) {
          await client.expire(prefixed(key), ttlSeconds);
        }

        return value;
      },
      () => this.memory.incrBy(prefixed(key), delta, ttlSeconds)
    );
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    return this.run(
      (client) => client.expire(prefixed(key), ttlSeconds).then(() => undefined),
      () => this.memory.expire(prefixed(key), ttlSeconds)
    );
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.run(
      (client) => client.hgetall(prefixed(key)),
      () => this.memory.hGetAll(prefixed(key))
    );
  }

  async hIncrBy(
    key: string,
    field: string,
    delta: number
  ): Promise<number> {
    return this.run(
      (client) =>
        client.hincrby(prefixed(key), field, delta),
      () => this.memory.hIncrBy(prefixed(key), field, delta)
    );
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    return this.run(
      (client) =>
        client.hset(prefixed(key), field, value).then(() => undefined),
      () => this.memory.hSet(prefixed(key), field, value)
    );
  }

  async hDel(key: string, ...fields: string[]): Promise<void> {
    return this.run(
      (client) =>
        client.hdel(prefixed(key), ...fields).then(() => undefined),
      () => this.memory.hDel(prefixed(key), ...fields)
    );
  }

  async sAdd(key: string, member: string): Promise<void> {
    return this.run(
      (client) =>
        client.sadd(prefixed(key), member).then(() => undefined),
      () => this.memory.sAdd(prefixed(key), member)
    );
  }

  async sMembers(key: string): Promise<string[]> {
    return this.run(
      (client) => client.smembers(prefixed(key)),
      () => this.memory.sMembers(prefixed(key))
    );
  }

  async sRem(key: string, member: string): Promise<void> {
    return this.run(
      (client) =>
        client.srem(prefixed(key), member).then(() => undefined),
      () => this.memory.sRem(prefixed(key), member)
    );
  }

  status(): { configured: boolean; available: boolean; mode: "redis" | "memory" } {
    const configured = this.redis !== null;
    const available =
      configured &&
      this.redis?.status === "ready" &&
      Date.now() >= this.degradedUntil;

    return {
      configured,
      available,
      mode: available ? "redis" : "memory",
    };
  }

  async ping(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.markDegraded(error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}

let store: CacheStore = new ResilientCacheStore();

export const getCacheStore = (): CacheStore => store;

export const getCacheStatus = (): {
  configured: boolean;
  available: boolean;
  mode: "redis" | "memory";
} => {
  if (store instanceof ResilientCacheStore) {
    return store.status();
  }

  return { configured: false, available: true, mode: "memory" };
};

export const initializeCache = async (): Promise<void> => {
  if (!(store instanceof ResilientCacheStore)) {
    return;
  }

  if (!env.REDIS_URL) {
    logInfo("redis_not_configured", { mode: "memory" });
    return;
  }

  logInfo("redis_configured", {
    configured: true,
    lazyConnect: true,
  });
};

export const disconnectCache = async (): Promise<void> => {
  if (store instanceof ResilientCacheStore) {
    await store.disconnect();
  }
};

/** Test hook: replace the singleton with an in-memory store. */
export const setCacheStoreForTests = (next: CacheStore): void => {
  store = next;
};

export const resetCacheStoreForTests = (): void => {
  store = new ResilientCacheStore();
};
