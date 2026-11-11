import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { MemoryCacheStore } = await import(
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
