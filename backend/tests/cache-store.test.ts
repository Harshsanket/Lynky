import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { MemoryCacheStore, normalizeHash } = await import(
  "../service/redis.client.js"
);

test("getHashAndDelete returns and removes all fields", async () => {
  const store = new MemoryCacheStore();

  await store.hSet("pending", "attempts", "3");
  await store.hSet("pending", "success", "2");

  assert.deepEqual(await store.getHashAndDelete("pending"), {
    attempts: "3",
    success: "2",
  });
  assert.deepEqual(await store.hGetAll("pending"), {});
});

test("setNx only acquires an unused or expired key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.setNx("lock", "first", 60), true);
  assert.equal(await store.setNx("lock", "second", 60), false);
  assert.equal(await store.get("lock"), "first");

  await store.del("lock");

  assert.equal(await store.setNx("lock", "third", 60), true);
  assert.equal(await store.get("lock"), "third");
});

test("incrBy keeps incrementing an existing key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.incrBy("counter", 1, 60), 1);
  assert.equal(await store.incrBy("counter", 1, 60), 2);
  assert.equal(await store.get("counter"), "2");
});

test("incrBy applies a TTL to an existing key without one", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const store = new MemoryCacheStore();

    await store.set("counter", "1");

    assert.equal(await store.incrBy("counter", 1, 60), 2);

    mock.timers.tick(60_001);

    assert.equal(await store.get("counter"), null);
  } finally {
    mock.timers.reset();
  }
});

test("incrByWithTtl returns the count and remaining window", async () => {
  const store = new MemoryCacheStore();

  const first = await store.incrByWithTtl("window", 1, 60);
  const second = await store.incrByWithTtl("window", 1, 60);

  assert.equal(first.count, 1);
  assert.equal(second.count, 2);
  assert.ok(second.ttlMs > 59_000);
  assert.ok(second.ttlMs <= 60_000);
});

test("decrByIfExists does not create a missing key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.decrByIfExists("missing", 1), null);
  assert.equal(await store.get("missing"), null);

  await store.incrBy("present", 2, 60);

  assert.equal(await store.decrByIfExists("present", 1), 1);
  assert.equal(await store.get("present"), "1");
});

test("delIfEquals only deletes the matching value", async () => {
  const store = new MemoryCacheStore();

  await store.set("lock", "token-a", 60);

  assert.equal(await store.delIfEquals("lock", "token-b"), false);
  assert.equal(await store.get("lock"), "token-a");

  assert.equal(await store.delIfEquals("lock", "token-a"), true);
  assert.equal(await store.get("lock"), null);
});

test("normalizeHash accepts flat arrays and objects, and rejects junk", () => {
  assert.deepEqual(normalizeHash(["a", "1", "b", "2"]), {
    a: "1",
    b: "2",
  });
  assert.deepEqual(normalizeHash({ a: 1, b: "2" }), {
    a: "1",
    b: "2",
  });
  assert.deepEqual(normalizeHash(null), {});
  assert.deepEqual(normalizeHash({}), {});
  assert.deepEqual(normalizeHash(["a"]), {});
  assert.deepEqual(normalizeHash(42), {});
});
