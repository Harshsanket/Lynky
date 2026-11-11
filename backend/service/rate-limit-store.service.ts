import {
  MemoryStore,
  type IncrementResponse,
  type Store,
} from "express-rate-limit";
import { getCacheStore } from "./redis.client.js";

/**
 * express-rate-limit store backed by the shared CacheStore.
 *
 * The default MemoryStore is per-instance on serverless, so its counters reset
 * on every cold start and never converge across instances. This adapter keeps
 * the same fixed-window semantics in Redis and falls back to the library's
 * MemoryStore only when the cache is unavailable.
 */
export class CacheRateLimitStore implements Store {
  readonly fallback = new MemoryStore();

  constructor(
    readonly prefix: string,
    readonly windowMs: number
  ) {}

  private key(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private get ttlSeconds(): number {
    return Math.max(1, Math.ceil(this.windowMs / 1000));
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const totalHits = await getCacheStore().incrBy(
        this.key(key),
        1,
        this.ttlSeconds
      );

      return {
        totalHits,
        resetTime: new Date(Date.now() + this.windowMs),
      };
    } catch {
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await getCacheStore().incrBy(
        this.key(key),
        -1,
        this.ttlSeconds
      );
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await getCacheStore().del(this.key(key));
    } catch {
      await this.fallback.resetKey(key);
    }
  }
}
