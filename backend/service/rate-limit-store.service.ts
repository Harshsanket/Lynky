import {
  MemoryStore,
  type IncrementResponse,
  type Options,
  type Store,
} from "express-rate-limit";
import { getCacheStore } from "./redis.client.js";
import { logWarn } from "./logger.js";

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

  windowMs: number;

  private lastFallbackLogAt = 0;

  constructor(
    readonly prefix: string,
    windowMs: number
  ) {
    this.windowMs = windowMs;
  }

  private noteFallback(): void {
    const now = Date.now();

    if (now - this.lastFallbackLogAt < this.windowMs) {
      return;
    }

    this.lastFallbackLogAt = now;
    logWarn("rate_limit_fallback_memory", {
      keyPrefix: this.prefix,
    });
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  shutdown(): void {
    this.fallback.shutdown();
  }

  private key(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private get ttlSeconds(): number {
    return Math.max(1, Math.ceil(this.windowMs / 1000));
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const { count, ttlMs } = await getCacheStore().incrByWithTtl(
        this.key(key),
        1,
        this.ttlSeconds
      );

      return {
        totalHits: count,
        resetTime: new Date(
          Date.now() + (ttlMs > 0 ? ttlMs : this.windowMs)
        ),
      };
    } catch {
      this.noteFallback();
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await getCacheStore().decrByIfExists(this.key(key), 1);
    } catch {
      this.noteFallback();
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await getCacheStore().del(this.key(key));
    } catch {
      this.noteFallback();
      await this.fallback.resetKey(key);
    }
  }
}
