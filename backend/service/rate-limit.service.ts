import { env } from "../src/config/env.js";
import { getCacheStore } from "./redis.client.js";

export interface GlobalRateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

const hourKey = (date = new Date()): string =>
  `rl:global:${Math.floor(date.getTime() / 3_600_000)}`;

const secondsUntilNextHour = (date = new Date()): number =>
  3600 - (Math.floor(date.getTime() / 1000) % 3600);

/**
 * One shared global counter per UTC hour. It intentionally ignores IPs so the
 * limit survives multiple instances without storing client addresses.
 */
export const consumeGlobalRateLimit = async (): Promise<GlobalRateLimitResult> => {
  const count = await getCacheStore().incrBy(hourKey(), 1, 3600);

  return {
    allowed: count <= env.GLOBAL_RATE_LIMIT_PER_HOUR,
    count,
    limit: env.GLOBAL_RATE_LIMIT_PER_HOUR,
    retryAfterSeconds: secondsUntilNextHour(),
  };
};

export const getCurrentGlobalRateCount = async (): Promise<number> => {
  try {
    return Number((await getCacheStore().get(hourKey())) ?? 0) || 0;
  } catch {
    return 0;
  }
};
