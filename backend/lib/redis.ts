import { Redis } from "@upstash/redis";
import { env } from "../src/config/env.js";

let client: Redis | null = null;

/**
 * Lazily create the Upstash REST client. Development and test runs do not
 * configure Upstash and use the in-memory cache instead.
 */
export const getUpstashRedis = (): Redis | null => {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  client ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: false,
  });

  return client;
};
