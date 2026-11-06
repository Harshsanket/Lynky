import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-code-salt-test$1")
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.MIN_CODE_LENGTH = "4";
process.env.MAX_CODE_LENGTH = "6";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { Link } = await import("../models/link.models.js");
const { Stats } = await import("../models/stats.models.js");
const {
  hashCode,
  isValidCodeSalt,
} = await import("../service/code-hash.service.js");
const { encryptUrl } = await import("../service/encryption.service.js");
const { hashUrl } = await import("../service/url-hasher.service.js");
const {
  createShortUrlFromPrepared,
} = await import("../service/url.service.js");
const { findLinkForRedirect } = await import(
  "../service/link-lookup.service.js"
);
const {
  incrementTotalLinks,
  scheduleTotalLinksIncrement,
} = await import("../service/stats.service.js");
const {
  runInBackground,
  flushBackgroundTasksForTests,
} = await import("../src/utils/background.js");

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;
const createdHashes: string[] = [];

const freshStore = () => {
  setCacheStoreForTests(new MemoryCacheStore());
};

const prepared = (label: string) => {
  const cleanedUrl = `https://example.com/${label}-${crypto.randomUUID()}`;
  const urlHash = hashUrl(cleanedUrl);

  createdHashes.push(urlHash);

  return { cleanedUrl, urlHash };
};

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Stats.deleteOne({ key: "global" });
});

after(async () => {
  await flushBackgroundTasksForTests();

  if (!testMongoUri) return;

  await Link.deleteMany({ urlHash: { $in: createdHashes } });
  await Stats.deleteOne({ key: "global" });
  await mongoose.disconnect();
});

run("stores only codeSalt + codeHash and re-derives the same code after cache loss", async () => {
  freshStore();

  const value = prepared("stable");
  const first = await createShortUrlFromPrepared(value);

  assert.equal(first.created, true);
  assert.match(first.code, /^[0-9A-Za-z]{4,6}$/);

  const raw = await Link.findOne({ urlHash: value.urlHash }).lean();

  assert.equal((raw as any)?.code, undefined);
  assert.equal(isValidCodeSalt(raw?.codeSalt), true);
  assert.equal(raw?.codeHash, hashCode(first.code));

  freshStore();

  const second = await createShortUrlFromPrepared(value);

  assert.equal(second.created, false);
  assert.equal(second.code, first.code);

  await flushBackgroundTasksForTests();
});

run("an expired row does not revive and yields a new code", async () => {
  freshStore();

  const value = prepared("expiry");
  const first = await createShortUrlFromPrepared(value);

  // TTL deletion is asynchronous; the create path must not revive the row
  // even while it is still present.
  await Link.updateOne(
    { urlHash: value.urlHash },
    { $set: { expiresAt: new Date(Date.now() - 1_000) } }
  );

  const second = await createShortUrlFromPrepared(value);

  assert.notEqual(second.code, first.code);
  assert.equal(second.created, true);
  assert.equal(await findLinkForRedirect(first.code), null);

  await flushBackgroundTasksForTests();
});

run("legacy rows without a salt rotate on the next shorten", async () => {
  freshStore();

  const value = prepared("legacy");
  const legacyCode = "legacy1";

  await Link.collection.insertOne({
    codeHash: hashCode(legacyCode),
    originalUrl: encryptUrl(value.cleanedUrl),
    urlHash: value.urlHash,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });

  const rotated = await createShortUrlFromPrepared(value);
  const rotatedRaw = await Link.findOne({ urlHash: value.urlHash }).lean();

  assert.notEqual(rotated.code, legacyCode);
  assert.equal(isValidCodeSalt(rotatedRaw?.codeSalt), true);
  assert.equal(await findLinkForRedirect(legacyCode), null);

  await flushBackgroundTasksForTests();
});

run("retries a codeHash collision with a new salt", async () => {
  freshStore();

  const value = prepared("collision");
  const originalCreate = Link.create.bind(Link);
  const salts: string[] = [];
  let calls = 0;

  (Link as any).create = async (doc: any) => {
    calls++;
    salts.push(String(doc.codeSalt));

    if (calls === 1) {
      const error: any = new Error("duplicate codeHash");
      error.code = 11000;
      error.keyPattern = { codeHash: 1 };
      throw error;
    }

    return originalCreate(doc);
  };

  try {
    const result = await createShortUrlFromPrepared(value);

    assert.equal(result.created, true);
    assert.equal(calls, 2);
    assert.equal(salts.length, 2);
    assert.notEqual(salts[0], salts[1]);
    assert.equal(isValidCodeSalt(salts[1]), true);
  } finally {
    (Link as any).create = originalCreate;
  }

  await flushBackgroundTasksForTests();
});

run("background stats increment converges after the response", async () => {
  freshStore();

  const before = await Stats.findOne({ key: "global" }).lean();

  runInBackground(() => incrementTotalLinks(), {
    event: "stats_increment_failed",
    errorCode: "stats_increment_failed",
    context: { source: "code-salt-integration-test" },
  });

  await flushBackgroundTasksForTests();

  const after = await Stats.findOne({ key: "global" }).lean();

  assert.equal(
    (after?.totalLinks ?? 0) - (before?.totalLinks ?? 0),
    1
  );
});

run("coalesced create-path stats increments converge", async () => {
  freshStore();

  const before = await Stats.findOne({ key: "global" }).lean();

  scheduleTotalLinksIncrement();
  scheduleTotalLinksIncrement();
  scheduleTotalLinksIncrement();

  await flushBackgroundTasksForTests();

  const after = await Stats.findOne({ key: "global" }).lean();

  assert.equal(
    (after?.totalLinks ?? 0) - (before?.totalLinks ?? 0),
    3
  );
});

run("an increment arriving during a flush is rescheduled without overcounting", async () => {
  freshStore();

  const before = await Stats.findOne({ key: "global" }).lean();

  scheduleTotalLinksIncrement();
  await new Promise((resolve) => setTimeout(resolve, 30));
  scheduleTotalLinksIncrement();

  await flushBackgroundTasksForTests();

  const after = await Stats.findOne({ key: "global" }).lean();

  assert.equal(
    (after?.totalLinks ?? 0) - (before?.totalLinks ?? 0),
    2
  );
});
