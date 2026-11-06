import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-click-test$1")
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.CLICK_STORAGE_MODE = "hybrid";
process.env.CLICK_FLUSH_EVERY_N = "1";
process.env.CLICK_FLUSH_INTERVAL_MS = "1";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { Link } = await import("../models/link.models.js");
const { Stats } = await import("../models/stats.models.js");
const { hashCode } = await import("../service/code-hash.service.js");
const { encryptUrl } = await import("../service/encryption.service.js");
const { recordClick } = await import(
  "../service/click-accounting.service.js"
);

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;
const createdHashes: string[] = [];

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Stats.deleteOne({ key: "global" });
});

after(async () => {
  if (!testMongoUri) return;

  await Link.deleteMany({ urlHash: { $in: createdHashes } });
  await Stats.deleteOne({ key: "global" });
  await mongoose.disconnect();
});

const makeLink = async () => {
  const code = crypto.randomBytes(4).toString("hex").slice(0, 6);
  const urlHash = `${crypto.randomBytes(32).toString("hex")}`;

  createdHashes.push(urlHash);

  await Link.create({
    codeHash: hashCode(code),
    originalUrl: encryptUrl("https://example.com/clicked"),
    urlHash,
    expiresAt: new Date(Date.now() + 60_000),
  });

  return code;
};

run("hybrid mode flushes cold and hot successful clicks plus failures", async () => {
  const code = await makeLink();

  await recordClick(code, true, { writeLinkNow: true });

  let link = await Link.findOne({
    codeHash: hashCode(code),
  }).lean();
  let stats = await Stats.findOne({ key: "global" }).lean();

  assert.equal(link?.visitCount, 1);
  assert.ok(link?.lastVisitedAt instanceof Date);
  assert.equal(stats?.totalClicksAttempts, 1);
  assert.equal(stats?.totalClicksSuccess, 1);
  assert.equal(stats?.totalClicksFailed, 0);
  assert.equal(stats?.totalRedirects, 1);

  await recordClick(code, true);

  link = await Link.findOne({ codeHash: hashCode(code) }).lean();
  stats = await Stats.findOne({ key: "global" }).lean();

  assert.equal(link?.visitCount, 2);
  assert.equal(stats?.totalClicksAttempts, 2);
  assert.equal(stats?.totalClicksSuccess, 2);
  assert.equal(stats?.totalRedirects, 2);

  await recordClick(code, false);

  stats = await Stats.findOne({ key: "global" }).lean();

  assert.equal(stats?.totalClicksAttempts, 3);
  assert.equal(stats?.totalClicksSuccess, 2);
  assert.equal(stats?.totalClicksFailed, 1);
  assert.equal(stats?.totalRedirects, 2);
});
