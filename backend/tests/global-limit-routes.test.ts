import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.GLOBAL_RATE_LIMIT_PER_HOUR = "3";

const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);

setCacheStoreForTests(new MemoryCacheStore());

const { default: app } = await import("../src/app.js");

test("the global limit is shared by health, readiness, and API routes", async () => {
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  assert.ok(address && typeof address === "object");

  const base = `http://127.0.0.1:${address.port}`;

  try {
    const first = await fetch(`${base}/health`);
    const second = await fetch(`${base}/api/v1/ping`);
    const third = await fetch(`${base}/health`);
    const fourth = await fetch(`${base}/ready`);

    assert.notEqual(first.status, 429);
    assert.notEqual(second.status, 429);
    assert.notEqual(third.status, 429);
    // The limiter runs before readiness, so the 4th request is rejected
    // without touching the controller or MongoDB.
    assert.equal(fourth.status, 429);
    assert.ok(Number(fourth.headers.get("retry-after")) > 0);
    assert.equal(fourth.headers.get("x-ratelimit-limit"), "3");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
