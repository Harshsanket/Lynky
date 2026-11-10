import type { Redis } from "@upstash/redis";
import { env } from "../src/config/env.js";
import { getUpstashRedis } from "../lib/redis.js";
import { logInfo } from "./logger.js";

/**
 * Small cache-store contract shared by the Upstash implementation and the
 * in-memory development/test store. Redis is cache-only (Mongo remains the
 * source of truth), so every operation is allowed to fail without breaking a
 * request.
 */
export type CachePipelineCommand =
  | { type: "hSet"; key: string; field: string; value: string }
  | { type: "hIncrBy"; key: string; field: string; delta: number }
  | { type: "expire"; key: string; ttlSeconds: number };

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
  pipeline(commands: CachePipelineCommand[]): Promise<void>;
  redirectPreflight(
    rateLimitKey: string,
    linkKey: string
  ): Promise<{ count: number; cachedRaw: string | null }>;
}

interface MemoryEntry {
  expiresAt: number | null;
  value: string | Map<string, string> | Set<string>;
}

const KEY_PREFIX =
  env.NODE_ENV === "test" ? "lynky:test:" : "lynky:";

const prefixed = (key: string): string => `${KEY_PREFIX}${key}`;

/**
 * Process-local store used for development and tests. A restart loses all
 * entries; that is intentional because development must not touch Upstash.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  private getEntry(key: string): MemoryEntry | null {
    const entry = this.entries.get(prefixed(key));

    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(prefixed(key));
      return null;
    }

    return entry;
  }

  private setEntry(
    key: string,
    value: MemoryEntry["value"],
    ttlSeconds?: number
  ): void {
    this.entries.set(prefixed(key), {
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
    this.entries.delete(prefixed(key));
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
      this.entries.delete(prefixed(key));
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
      this.entries.delete(prefixed(key));
    }
  }

  async pipeline(commands: CachePipelineCommand[]): Promise<void> {
    for (const command of commands) {
      if (command.type === "hSet") {
        await this.hSet(command.key, command.field, command.value);
      } else if (command.type === "hIncrBy") {
        await this.hIncrBy(command.key, command.field, command.delta);
      } else {
        await this.expire(command.key, command.ttlSeconds);
      }
    }
  }

  async redirectPreflight(
    rateLimitKey: string,
    linkKey: string
  ): Promise<{ count: number; cachedRaw: string | null }> {
    const count = await this.incrBy(rateLimitKey, 1, 3600);
    const cachedRaw = await this.get(linkKey);

    return { count, cachedRaw };
  }
}

/**
 * Upstash REST store. Disabling automatic deserialization keeps all values as
 * the strings the cache contract expects; HGETALL therefore returns a flat
 * [field, value, ...] array that is normalized below.
 */
class UpstashCacheStore implements CacheStore {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return (await this.client.get<string>(prefixed(key))) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds === undefined) {
      await this.client.set(prefixed(key), value);
      return;
    }

    await this.client.set(prefixed(key), value, { ex: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.client.del(prefixed(key));
  }

  async incrBy(
    key: string,
    delta: number,
    ttlSeconds?: number
  ): Promise<number> {
    const value = await this.client.incrby(prefixed(key), delta);

    if (value === delta && ttlSeconds !== undefined) {
      await this.client.expire(prefixed(key), ttlSeconds);
    }

    return value;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(prefixed(key), ttlSeconds);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const raw = (await this.client.hgetall(prefixed(key))) as unknown;

    if (Array.isArray(raw)) {
      const result: Record<string, string> = {};

      for (let index = 0; index < raw.length; index += 2) {
        const field = raw[index];
        const value = raw[index + 1];

        if (typeof field === "string" && typeof value === "string") {
          result[field] = value;
        }
      }

      return result;
    }

    if (raw && typeof raw === "object") {
      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(
          ([field, value]) => [field, String(value)]
        )
      );
    }

    return {};
  }

  async hIncrBy(
    key: string,
    field: string,
    delta: number
  ): Promise<number> {
    return this.client.hincrby(prefixed(key), field, delta);
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(prefixed(key), { [field]: value });
  }

  async hDel(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(prefixed(key), ...fields);
  }

  async sAdd(key: string, member: string): Promise<void> {
    await this.client.sadd(prefixed(key), member);
  }

  async sMembers(key: string): Promise<string[]> {
    return this.client.smembers(prefixed(key));
  }

  async sRem(key: string, member: string): Promise<void> {
    await this.client.srem(prefixed(key), member);
  }

  async pipeline(commands: CachePipelineCommand[]): Promise<void> {
    if (commands.length === 0) {
      return;
    }

    const pipeline = this.client.pipeline();

    for (const command of commands) {
      if (command.type === "hSet") {
        pipeline.hset(prefixed(command.key), {
          [command.field]: command.value,
        });
      } else if (command.type === "hIncrBy") {
        pipeline.hincrby(
          prefixed(command.key),
          command.field,
          command.delta
        );
      } else {
        pipeline.expire(
          prefixed(command.key),
          command.ttlSeconds
        );
      }
    }

    await pipeline.exec();
  }

  async redirectPreflight(
    rateLimitKey: string,
    linkKey: string
  ): Promise<{ count: number; cachedRaw: string | null }> {
    const pipeline = this.client.pipeline();

    pipeline.incrby(prefixed(rateLimitKey), 1);
    pipeline.expire(prefixed(rateLimitKey), 3600);
    pipeline.get<string>(prefixed(linkKey));

    const result = await pipeline.exec();

    return {
      count: Number(result[0] ?? 0),
      cachedRaw: (result[2] as string | null) ?? null,
    };
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }
}

let store: CacheStore | null = null;

const createCacheStore = (): CacheStore => {
  if (!env.isProduction) {
    return new MemoryCacheStore();
  }

  const client = getUpstashRedis();

  if (!client) {
    throw new Error(
      "Upstash Redis is required in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  return new UpstashCacheStore(client);
};

export const getCacheStore = (): CacheStore => {
  store ??= createCacheStore();
  return store;
};

export const getCacheStatus = (): {
  configured: boolean;
  available: boolean;
  mode: "redis" | "memory";
} => {
  if (store instanceof UpstashCacheStore) {
    return { configured: true, available: true, mode: "redis" };
  }

  return { configured: false, available: true, mode: "memory" };
};

export const initializeCache = async (): Promise<void> => {
  const cache = getCacheStore();

  if (cache instanceof UpstashCacheStore) {
    await cache.ping();
    logInfo("upstash_configured", { mode: "upstash" });
    return;
  }

  logInfo("cache_memory_mode", { mode: "memory" });
};

/** Test hook: replace the singleton with an in-memory store. */
export const setCacheStoreForTests = (next: CacheStore): void => {
  store = next;
};
