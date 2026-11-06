import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.CLICK_STORAGE_MODE = "dynamic";
process.env.CLICK_EXACT_BELOW_PER_HOUR = "5";

const { MemoryCacheStore, setCacheStoreForTests, getCacheStore } =
  await import("../service/redis.client.js");
const { resolveClickStorageMode } = await import(
  "../service/click-accounting.service.js"
);

const store = new MemoryCacheStore();

setCacheStoreForTests(store);

test("dynamic mode writes through while traffic is below the threshold", async () => {
  const hour = Math.floor(Date.now() / 3_600_000);

  await getCacheStore().set(`rl:global:${hour}`, "4", 3600);

  assert.equal(await resolveClickStorageMode(), "exact");
});

test("dynamic mode buffers once traffic reaches the threshold", async () => {
  const hour = Math.floor(Date.now() / 3_600_000);

  await getCacheStore().set(`rl:global:${hour}`, "5", 3600);

  assert.equal(await resolveClickStorageMode(), "hybrid");
});
