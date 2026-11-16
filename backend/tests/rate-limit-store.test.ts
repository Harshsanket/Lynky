import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { CacheRateLimitStore } = await import(
  "../service/rate-limit-store.service.js"
);

test("increments, decrements, and resets one window", async () => {
  setCacheStoreForTests(new MemoryCacheStore());

  const store = new CacheRateLimitStore("test", 60_000);

  const first = await store.increment("ip");

  assert.equal(first.totalHits, 1);
  assert.ok(first.resetTime instanceof Date);

  const second = await store.increment("ip");

  assert.equal(second.totalHits, 2);

  await store.decrement("ip");

  assert.equal((await store.increment("ip")).totalHits, 2);

  await store.resetKey("ip");

  assert.equal((await store.increment("ip")).totalHits, 1);
});

test("falls back to memory when the cache store fails", async () => {
  setCacheStoreForTests({
    incrByWithTtl: async () => {
      throw new Error("redis down");
    },
    decrByIfExists: async () => {
      throw new Error("redis down");
    },
    del: async () => {
      throw new Error("redis down");
    },
  } as any);

  const store = new CacheRateLimitStore("fallback", 60_000);
  const result = await store.increment("ip");

  assert.equal(result.totalHits, 1);
});

test("initializes the fallback store and recycles counters", async () => {
  mock.timers.enable({
    apis: ["setTimeout", "setInterval", "Date"],
  });

  try {
    setCacheStoreForTests({
      incrByWithTtl: async () => {
        throw new Error("redis down");
      },
    } as any);

    const store = new CacheRateLimitStore("fallback-init", 60_000);

    store.init({ windowMs: 60_000 } as any);

    const first = await store.increment("ip");

    assert.equal(first.totalHits, 1);
    assert.ok(first.resetTime);
    assert.ok(Number.isFinite(first.resetTime.getTime()));

    mock.timers.tick(60_001);

    const second = await store.increment("ip");

    assert.equal(second.totalHits, 1);
  } finally {
    mock.timers.reset();
  }
});

test("uses the cache TTL for resetTime", async () => {
  setCacheStoreForTests(new MemoryCacheStore());

  const store = new CacheRateLimitStore("ttl", 60_000);

  store.init({ windowMs: 60_000 } as any);

  const before = Date.now();
  const result = await store.increment("ip");

  assert.ok(result.resetTime);
  assert.ok(result.resetTime.getTime() >= before + 59_000);
  assert.ok(result.resetTime.getTime() <= before + 60_500);
});

test("decrement does not create a missing counter", async () => {
  const cache = new MemoryCacheStore();

  setCacheStoreForTests(cache);

  const store = new CacheRateLimitStore("decrement", 60_000);

  store.init({ windowMs: 60_000 } as any);
  await store.decrement("missing");

  assert.equal(await cache.get("decrement:missing"), null);
});
