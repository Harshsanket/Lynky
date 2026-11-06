import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.GLOBAL_RATE_LIMIT_PER_HOUR = "2";

const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { consumeGlobalRateLimit, getCurrentGlobalRateCount } = await import(
  "../service/rate-limit.service.js"
);
const { rateLimitMiddleware } = await import(
  "../middleware/rate-limit.middleware.js"
);

setCacheStoreForTests(new MemoryCacheStore());

test("enforces the configured global hourly limit", async () => {
  const first = await consumeGlobalRateLimit();
  const second = await consumeGlobalRateLimit();
  const third = await consumeGlobalRateLimit();

  assert.equal(first.allowed, true);
  assert.equal(first.limit, 2);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.count, 3);
  assert.ok(third.retryAfterSeconds > 0);
  assert.equal(await getCurrentGlobalRateCount(), 3);
});

test("middleware fails open when the cache store is unavailable", async () => {
  setCacheStoreForTests({
    incrBy: async () => {
      throw new Error("redis down");
    },
  } as any);

  const makeRes = () => ({
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  });

  let nextCalls = 0;
  const response = makeRes();

  await rateLimitMiddleware(
    {} as any,
    response as any,
    (() => {
      nextCalls++;
    }) as any
  );

  assert.equal(nextCalls, 1);
  assert.equal(response.statusCode, 200);

  setCacheStoreForTests(new MemoryCacheStore());
});

test("middleware returns 429 with Retry-After when the budget is exhausted", async () => {
  setCacheStoreForTests(new MemoryCacheStore());

  const makeRes = () => ({
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  });

  let nextCalls = 0;
  const next = () => {
    nextCalls++;
  };

  await rateLimitMiddleware({} as any, makeRes() as any, next as any);
  await rateLimitMiddleware({} as any, makeRes() as any, next as any);
  const third = makeRes();

  await rateLimitMiddleware({} as any, third as any, next as any);

  assert.equal(nextCalls, 2);
  assert.equal(third.statusCode, 429);
  assert.ok(Number(third.headers["retry-after"]) > 0);
});
