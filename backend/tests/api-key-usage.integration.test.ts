import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Types } from "mongoose";

const testMongoUri = process.env.TEST_MONGODB_URI;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.API_KEY_MONTHLY_LIMIT = "10000";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { ApiKey, getUsageMonth } = await import(
  "../models/api-key.models.js"
);
const { Link } = await import("../models/link.models.js");
const {
  createShortUrlFromPrepared,
  prepareUrl,
} = await import("../service/url.service.js");
const {
  decrementApiKeyUsage,
  incrementApiKeyUsage,
} = await import("../service/api-key.service.js");

const run = testMongoUri ? test : test.skip;
const createdHashes: string[] = [];
const createdKeyIds: Types.ObjectId[] = [];

const makeKey = async (overrides: Record<string, unknown> = {}) => {
  const key = await ApiKey.create({
    keyHash: crypto.randomBytes(32).toString("hex"),
    status: "active",
    monthlyUsageCount: 0,
    usageMonth: getUsageMonth(),
    usageHistory: [],
    ...overrides,
  });

  createdKeyIds.push(key._id);

  return key;
};

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
});

after(async () => {
  if (!testMongoUri) return;

  await ApiKey.deleteMany({
    _id: { $in: createdKeyIds },
  });
  await Link.deleteMany({
    urlHash: { $in: createdHashes },
  });
  await mongoose.disconnect();
});

run("increments usage for the current month", async () => {
  const key = await makeKey();

  assert.equal(await incrementApiKeyUsage(key._id), true);

  const updated = await ApiKey.findById(key._id).lean();

  assert.equal(updated?.monthlyUsageCount, 1);
  assert.equal(updated?.usageMonth, getUsageMonth());
});

run("rolls over cleanly at a month boundary", async () => {
  const key = await makeKey({
    usageMonth: "2000-01",
    monthlyUsageCount: 5,
    usageHistory: [{ month: "2000-01", count: 5 }],
  });

  assert.equal(await incrementApiKeyUsage(key._id), true);

  const updated = await ApiKey.findById(key._id).lean();

  assert.equal(updated?.monthlyUsageCount, 1);
  assert.equal(updated?.usageMonth, getUsageMonth());
  assert.deepEqual(
    updated?.usageHistory.find(
      (entry) => entry.month === "2000-01"
    )?.count,
    5
  );
  assert.equal(
    updated?.usageHistory.find(
      (entry) => entry.month === getUsageMonth()
    )?.count,
    1
  );
});

run("does not charge a disabled key", async () => {
  const key = await makeKey({ status: "disabled" });

  assert.equal(await incrementApiKeyUsage(key._id), false);
});

run("rolls back a reserved slot", async () => {
  const key = await makeKey();

  assert.equal(await incrementApiKeyUsage(key._id), true);
  assert.equal(await decrementApiKeyUsage(key._id), true);

  const updated = await ApiKey.findById(key._id).lean();

  assert.equal(updated?.monthlyUsageCount, 0);
});

run("stops at the monthly limit", async () => {
  const key = await makeKey({
    monthlyUsageCount: 10000,
    usageMonth: getUsageMonth(),
    usageHistory: [
      { month: getUsageMonth(), count: 10000 },
    ],
  });

  assert.equal(await incrementApiKeyUsage(key._id), false);
});

run("marks duplicate shorten requests as not created", async () => {
  const uniqueValue = crypto.randomUUID();
  const prepared = prepareUrl(
    `https://example.com/item?cachebust=${uniqueValue}`
  );

  createdHashes.push(prepared.urlHash);

  const first = await createShortUrlFromPrepared(prepared);
  const second = await createShortUrlFromPrepared(prepared);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.code, second.code);
});
