import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-exact-test$1")
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.CLICK_STORAGE_MODE = "exact";

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

run("exact mode writes Mongo immediately without a pending bucket", async () => {
  const code = crypto.randomBytes(4).toString("hex").slice(0, 6);
  const urlHash = `${crypto.randomBytes(32).toString("hex")}`;

  createdHashes.push(urlHash);

  await Link.create({
    codeHash: hashCode(code),
    originalUrl: encryptUrl("https://example.com/exact"),
    urlHash,
    expiresAt: new Date(Date.now() + 60_000),
  });

  await recordClick(code, true);

  const link = await Link.findOne({
    codeHash: hashCode(code),
  }).lean();
  const stats = await Stats.findOne({ key: "global" }).lean();

  assert.equal(link?.visitCount, 1);
  assert.equal(stats?.totalClicksAttempts, 1);
  assert.equal(stats?.totalClicksSuccess, 1);
  assert.equal(stats?.totalRedirects, 1);
});
