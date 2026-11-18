import type { Redis } from "@upstash/redis";
import { env } from "../src/config/env.js";
import { getUpstashRedis } from "../lib/redis.js";
import { logInfo, logWarn } from "./logger.js";

/**
 * Small cache-store contract shared by the Upstash implementation and the
 * in-memory development/test store. Redis is cache-only (Mongo remains the
 * source of truth), so every operation is allowed to fail without breaking a
 * request.
 */
export type CachePipelineCommand =
  | { type: "hSet"; key: string; field: string; value: string }
  | { type: "hIncrBy"; key: string; field: string; delta: number }
  | { type: "expire"; key: string; ttlSeconds: number }
  | { type: "del"; key: string };

/**
 * Fixed field whitelist for the per-minute metric hash. Anything outside this
 * set is rejected before Redis is touched.
 */
export const MINUTE_METRIC_FIELDS = [
  "requests",
  "latencySum",
  "latencyCount",
  "success",
  "failed",
  "status4xx",
  "status5xx",
  "status429",
  "errorCount",
  "cacheHit",
  "cacheMiss",
  "redisHit",
  "redisMiss",
  "mongoCalls",
  "redisCalls",
  "authFailures",
  "shortCodeExhausted",
] as const;

export type MinuteMetricField = (typeof MINUTE_METRIC_FIELDS)[number];

export interface RecordMinuteMetricsInput {
  key: string;
  pendingKey: string;
  routesKey: string;
  ttlSeconds: number;
  epoch: string;
  route: string;
  durationMs: number;
  fields: Record<string, number>;
}

const MINUTE_METRIC_FIELD_SET = new Set<string>(
  MINUTE_METRIC_FIELDS
);

/** Validate a minute-metric write before touching Redis. */
export const validateMinuteMetricsInput = (
  input: RecordMinuteMetricsInput
): void => {
  if (
    !input ||
    typeof input.key !== "string" ||
    !input.key ||
    typeof input.pendingKey !== "string" ||
    !input.pendingKey ||
    typeof input.routesKey !== "string" ||
    !input.routesKey ||
    typeof input.epoch !== "string" ||
    !input.epoch ||
    typeof input.route !== "string" ||
    !input.route
  ) {
    throw new Error("invalid minute metric key");
  }

  if (
    !Number.isInteger(input.ttlSeconds) ||
    input.ttlSeconds <= 0
  ) {
    throw new Error("invalid minute metric ttl");
  }

  if (
    !Number.isInteger(input.durationMs) ||
    input.durationMs < 0
  ) {
    throw new Error("invalid minute metric duration");
  }

  for (const [field, delta] of Object.entries(
    input.fields ?? {}
  )) {
    if (!MINUTE_METRIC_FIELD_SET.has(field)) {
      throw new Error(`unexpected minute metric field: ${field}`);
    }

    if (!Number.isInteger(delta) || delta <= 0) {
      throw new Error(`invalid minute metric delta: ${field}`);
    }
  }
};

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delIfEquals(key: string, value: string): Promise<boolean>;
  incrBy(key: string, delta: number, ttlSeconds?: number): Promise<number>;
  incrByWithTtl(
    key: string,
    delta: number,
    ttlSeconds: number
  ): Promise<{ count: number; ttlMs: number }>;
  decrByIfExists(key: string, delta: number): Promise<number | null>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  hGetAll(key: string): Promise<Record<string, string>>;
  getHashAndDelete(key: string): Promise<Record<string, string>>;
  hIncrBy(key: string, field: string, delta: number): Promise<number>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  hSet(key: string, field: string, value: string): Promise<void>;
  hDel(key: string, ...fields: string[]): Promise<void>;
  sAdd(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, member: string): Promise<void>;
  recordMinuteMetrics(
    input: RecordMinuteMetricsInput
  ): Promise<void>;
  pipeline(commands: CachePipelineCommand[]): Promise<void>;
  redirectPreflight(
    rateLimitKey: string,
    linkKey: string
  ): Promise<{ count: number; cachedRaw: string | null }>;
}

export interface MetricKeyTtl {
  key: string;
  ttl: number;
}

/** Maintenance-only surface; unavailable on the memory fallback. */
export interface MetricMaintenanceStore {
  listOrphanedMetricKeys(
    pattern: string
  ): Promise<MetricKeyTtl[]>;
  deleteOrphanedMetricKeys(pattern: string): Promise<number>;
}

interface MemoryEntry {
  expiresAt: number | null;
  value: string | Map<string, string> | Set<string>;
}

const KEY_PREFIX =
  env.NODE_ENV === "test" ? "lynky:test:" : "lynky:";

const prefixed = (key: string): string => `${KEY_PREFIX}${key}`;

/**
 * HGETALL may arrive as a flat [field, value, ...] array (automatic
 * deserialization is disabled) or as a plain object from newer client paths.
 */
export const normalizeHash = (raw: unknown): Record<string, string> => {
  if (Array.isArray(raw)) {
    if (raw.length % 2 !== 0) {
      logWarn("cache_hash_shape_unexpected", {
        errorCode: "cache_hash_shape",
        shape: "odd_array",
      });
    }

    const result: Record<string, string> = {};

    for (let index = 0; index < raw.length; index += 2) {
      const field = raw[index];
      const value = raw[index + 1];

      if (typeof field === "string" && typeof value === "string") {
        result[field] = value;
      } else {
        logWarn("cache_hash_shape_unexpected", {
          errorCode: "cache_hash_shape",
          shape: "malformed_pair",
        });
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

  if (raw !== null && raw !== undefined) {
    logWarn("cache_hash_shape_unexpected", {
      errorCode: "cache_hash_shape",
      shape: typeof raw,
    });
  }

  return {};
};

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

  async delIfEquals(key: string, value: string): Promise<boolean> {
    const entry = this.getEntry(key);

    if (!entry || entry.value !== value) {
      return false;
    }

    this.entries.delete(prefixed(key));

    return true;
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

      if (ttlSeconds !== undefined && entry.expiresAt === null) {
        entry.expiresAt = Date.now() + ttlSeconds * 1000;
      }
    } else {
      this.setEntry(key, String(next), ttlSeconds);
    }

    return next;
  }

  async incrByWithTtl(
    key: string,
    delta: number,
    ttlSeconds: number
  ): Promise<{ count: number; ttlMs: number }> {
    const entry = this.getEntry(key);
    const current =
      typeof entry?.value === "string" ? Number(entry.value) : 0;
    const count = (Number.isFinite(current) ? current : 0) + delta;
    const now = Date.now();

    if (entry) {
      entry.value = String(count);

      if (entry.expiresAt === null) {
        entry.expiresAt = now + ttlSeconds * 1000;
      }
    } else {
      this.setEntry(key, String(count), ttlSeconds);
    }

    const expiresAt = this.getEntry(key)?.expiresAt ?? null;

    return {
      count,
      ttlMs:
        expiresAt === null
          ? ttlSeconds * 1000
          : Math.max(0, expiresAt - now),
    };
  }

  async decrByIfExists(
    key: string,
    delta: number
  ): Promise<number | null> {
    const entry = this.getEntry(key);

    if (typeof entry?.value !== "string") {
      return null;
    }

    const current = Number(entry.value);
    const next = (Number.isFinite(current) ? current : 0) - delta;

    entry.value = String(next);

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

  async getHashAndDelete(
    key: string
  ): Promise<Record<string, string>> {
    const entry = this.getEntry(key);

    if (!(entry?.value instanceof Map)) {
      return {};
    }

    const result = Object.fromEntries(entry.value);

    this.entries.delete(prefixed(key));

    return result;
  }

  async setNx(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<boolean> {
    if (this.getEntry(key)) {
      return false;
    }

    this.setEntry(key, value, ttlSeconds);

    return true;
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

  async recordMinuteMetrics(
    input: RecordMinuteMetricsInput
  ): Promise<void> {
    validateMinuteMetricsInput(input);

    for (const [field, delta] of Object.entries(input.fields)) {
      await this.hIncrBy(input.key, field, delta);
    }

    const existing = await this.hGetAll(input.key);
    const currentMin = Number(existing.minMs ?? 0);
    const currentMax = Number(existing.maxMs ?? 0);

    if (
      existing.minMs === undefined ||
      input.durationMs < currentMin
    ) {
      await this.hSet(
        input.key,
        "minMs",
        String(input.durationMs)
      );
    }

    if (
      existing.maxMs === undefined ||
      input.durationMs > currentMax
    ) {
      await this.hSet(
        input.key,
        "maxMs",
        String(input.durationMs)
      );
    }

    await this.expire(input.key, input.ttlSeconds);
    await this.sAdd(input.pendingKey, input.epoch);
    await this.expire(input.pendingKey, input.ttlSeconds);
    await this.sAdd(input.routesKey, input.route);
    await this.expire(input.routesKey, input.ttlSeconds);
  }

  async pipeline(commands: CachePipelineCommand[]): Promise<void> {
    for (const command of commands) {
      if (command.type === "hSet") {
        await this.hSet(command.key, command.field, command.value);
      } else if (command.type === "hIncrBy") {
        await this.hIncrBy(command.key, command.field, command.delta);
      } else if (command.type === "expire") {
        await this.expire(command.key, command.ttlSeconds);
      } else {
        await this.del(command.key);
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

const LIST_ORPHANED_METRIC_KEYS_SCRIPT =
  "local keys = redis.call('KEYS', ARGV[1]); " +
  "local out = {}; " +
  "for i = 1, #keys do " +
  "local ttl = redis.call('TTL', keys[i]); " +
  "if ttl == -1 then " +
  "table.insert(out, keys[i]); " +
  "table.insert(out, tostring(ttl)); " +
  "end; " +
  "end; " +
  "return out";

const DELETE_ORPHANED_METRIC_KEYS_SCRIPT =
  "local keys = redis.call('KEYS', ARGV[1]); " +
  "local deleted = 0; " +
  "for i = 1, #keys do " +
  "if redis.call('TTL', keys[i]) == -1 then " +
  "redis.call('DEL', keys[i]); " +
  "deleted = deleted + 1; " +
  "end; " +
  "end; " +
  "return deleted";

const RECORD_MINUTE_METRICS_SCRIPT =
  "local ttl = tonumber(ARGV[1]); " +
  "local epoch = ARGV[2]; " +
  "local route = ARGV[3]; " +
  "local duration = tonumber(ARGV[4]); " +
  "for i = 5, #ARGV, 2 do " +
  "redis.call('HINCRBY', KEYS[1], ARGV[i], ARGV[i + 1]); " +
  "end; " +
  "local min = redis.call('HGET', KEYS[1], 'minMs'); " +
  "local max = redis.call('HGET', KEYS[1], 'maxMs'); " +
  "if not min or duration < tonumber(min) then " +
  "redis.call('HSET', KEYS[1], 'minMs', duration); " +
  "end; " +
  "if not max or duration > tonumber(max) then " +
  "redis.call('HSET', KEYS[1], 'maxMs', duration); " +
  "end; " +
  "redis.call('EXPIRE', KEYS[1], ttl); " +
  "redis.call('SADD', KEYS[2], epoch); " +
  "redis.call('EXPIRE', KEYS[2], ttl); " +
  "redis.call('SADD', KEYS[3], route); " +
  "redis.call('EXPIRE', KEYS[3], ttl); " +
  "return 1";

/**
 * Upstash REST store. Disabling automatic deserialization keeps all values as
 * the strings the cache contract expects; HGETALL therefore returns a flat
 * [field, value, ...] array that is normalized below.
 */
class UpstashCacheStore
  implements CacheStore, MetricMaintenanceStore
{
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

  async delIfEquals(key: string, value: string): Promise<boolean> {
    const result = await this.client.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
        "return redis.call('DEL', KEYS[1]) else return 0 end",
      [prefixed(key)],
      [value]
    );

    return Number(result) === 1;
  }

  async incrBy(
    key: string,
    delta: number,
    ttlSeconds?: number
  ): Promise<number> {
    if (ttlSeconds === undefined) {
      return this.client.incrby(prefixed(key), delta);
    }

    const value = await this.client.eval(
      "local v = redis.call('INCRBY', KEYS[1], ARGV[1]); " +
        "if redis.call('TTL', KEYS[1]) < 0 then " +
        "redis.call('EXPIRE', KEYS[1], ARGV[2]) end; return v",
      [prefixed(key)],
      [String(delta), String(ttlSeconds)]
    );

    return Number(value);
  }

  async incrByWithTtl(
    key: string,
    delta: number,
    ttlSeconds: number
  ): Promise<{ count: number; ttlMs: number }> {
    const raw = await this.client.eval(
      "local v = redis.call('INCRBY', KEYS[1], ARGV[1]); " +
        "local ttl = redis.call('PTTL', KEYS[1]); " +
        "if ttl < 0 then " +
        "redis.call('EXPIRE', KEYS[1], ARGV[2]); " +
        "ttl = tonumber(ARGV[2]) * 1000 end; " +
        "return {v, ttl}",
      [prefixed(key)],
      [String(delta), String(ttlSeconds)]
    );

    const tuple = Array.isArray(raw) ? raw : [];
    const count = Number(tuple[0]);
    const ttlMs = Number(tuple[1]);

    return {
      count: Number.isFinite(count) ? count : 0,
      ttlMs: Number.isFinite(ttlMs) ? ttlMs : ttlSeconds * 1000,
    };
  }

  async decrByIfExists(
    key: string,
    delta: number
  ): Promise<number | null> {
    const raw = await this.client.eval(
      "if redis.call('EXISTS', KEYS[1]) == 1 then " +
        "return redis.call('DECRBY', KEYS[1], ARGV[1]) else return nil end",
      [prefixed(key)],
      [String(delta)]
    );

    if (raw === null || raw === undefined) {
      return null;
    }

    const value = Number(raw);

    return Number.isFinite(value) ? value : null;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(prefixed(key), ttlSeconds);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return normalizeHash(
      (await this.client.hgetall(prefixed(key))) as unknown
    );
  }

  async getHashAndDelete(
    key: string
  ): Promise<Record<string, string>> {
    const raw = await this.client.eval(
      "local v = redis.call('HGETALL', KEYS[1]); " +
        "if #v > 0 then redis.call('DEL', KEYS[1]) end; return v",
      [prefixed(key)],
      []
    );

    return normalizeHash(raw);
  }

  async setNx(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const result = await this.client.set(
      prefixed(key),
      value,
      { nx: true, ex: ttlSeconds }
    );

    return result === "OK";
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

  async recordMinuteMetrics(
    input: RecordMinuteMetricsInput
  ): Promise<void> {
    validateMinuteMetricsInput(input);

    const args = [
      String(input.ttlSeconds),
      input.epoch,
      input.route,
      String(input.durationMs),
    ];

    for (const [field, delta] of Object.entries(input.fields)) {
      args.push(field, String(delta));
    }

    await this.client.eval(
      RECORD_MINUTE_METRICS_SCRIPT,
      [
        prefixed(input.key),
        prefixed(input.pendingKey),
        prefixed(input.routesKey),
      ],
      args
    );
  }

  async listOrphanedMetricKeys(
    pattern: string
  ): Promise<MetricKeyTtl[]> {
    const raw = await this.client.eval(
      LIST_ORPHANED_METRIC_KEYS_SCRIPT,
      [],
      [pattern]
    );
    const flat = Array.isArray(raw) ? raw : [];
    const result: MetricKeyTtl[] = [];

    for (let index = 0; index + 1 < flat.length; index += 2) {
      result.push({
        key: String(flat[index]),
        ttl: Number(flat[index + 1]),
      });
    }

    return result;
  }

  async deleteOrphanedMetricKeys(pattern: string): Promise<number> {
    const raw = await this.client.eval(
      DELETE_ORPHANED_METRIC_KEYS_SCRIPT,
      [],
      [pattern]
    );

    return Number(raw);
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
      } else if (command.type === "expire") {
        pipeline.expire(
          prefixed(command.key),
          command.ttlSeconds
        );
      } else {
        pipeline.del(prefixed(command.key));
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

/** Maintenance-only: returns null on the local memory fallback. */
export const getMetricMaintenanceStore =
  (): MetricMaintenanceStore | null => {
    const cache = getCacheStore();

    return cache instanceof UpstashCacheStore ? cache : null;
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
