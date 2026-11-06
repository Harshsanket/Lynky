import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-stats-test$1")
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { Stats } = await import("../models/stats.models.js");
const {
  getStatsSnapshot,
  invalidateStatsCache,
} = await import("../service/stats.service.js");

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Stats.deleteOne({ key: "global" });
});

after(async () => {
  if (!testMongoUri) return;

  await Stats.deleteOne({ key: "global" });
  await mongoose.disconnect();
});

run("caches the stats snapshot and force-refreshes on demand", async () => {
  await Stats.create({
    key: "global",
    totalLinks: 5,
    totalRedirects: 2,
    totalClicksAttempts: 10,
    totalClicksSuccess: 7,
    totalClicksFailed: 3,
  });

  invalidateStatsCache();

  const first = await getStatsSnapshot({ force: true });

  assert.equal(first.totalLinks, 5);
  assert.equal(first.totalClicksSuccess, 7);

  await Stats.updateOne({ key: "global" }, { $set: { totalLinks: 9 } });

  const cached = await getStatsSnapshot();

  assert.equal(cached.totalLinks, 5);

  invalidateStatsCache();

  const refreshed = await getStatsSnapshot();

  assert.equal(refreshed.totalLinks, 9);
});

run("single-flights concurrent cold reads", async () => {
  invalidateStatsCache();

  const original = Stats.findOne.bind(Stats) as any;
  let calls = 0;

  (Stats as any).findOne = (...args: any[]) => {
    calls++;
    return original(...args);
  };

  try {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => getStatsSnapshot())
    );

    assert.equal(calls, 1);
    assert.equal(new Set(results.map((entry) => entry.totalLinks)).size, 1);
  } finally {
    (Stats as any).findOne = original;
  }
});
