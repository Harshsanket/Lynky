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
  ApiKeyError,
  decrementApiKeyUsage,
  deleteApiKey,
  findAndRolloverApiKey,
  incrementApiKeyUsage,
  listApiKeys,
  MONTHLY_LINK_LIMIT,
  provisionApiKey,
  resetApiKeyUsage,
  setApiKeyStatus,
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


run("provisions a labelled key with a safe projection", async () => {
  const result = await provisionApiKey({
    label: "  production scripts  ",
  });

  createdKeyIds.push(
    new mongoose.Types.ObjectId(result.key.id)
  );

  assert.equal(result.secret.length > 0, true);
  assert.equal(result.key.label, "production scripts");
  assert.equal(result.key.keyPrefix, result.secret.slice(0, 8));
  assert.equal(result.key.status, "active");
  assert.equal(result.key.usage.limit, MONTHLY_LINK_LIMIT);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.key, "keyHash"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.key, "secret"),
    false
  );

  const stored = await ApiKey.findById(result.key.id).lean();

  assert.equal(stored?.keyHash.length, 64);
  assert.equal(stored?.label, "production scripts");
  assert.equal(stored?.keyPrefix, result.secret.slice(0, 8));
});

run("lists keys without key hashes or secrets", async () => {
  const result = await provisionApiKey({ label: "list me" });

  createdKeyIds.push(
    new mongoose.Types.ObjectId(result.key.id)
  );

  const keys = await listApiKeys();
  const listed = keys.find((key) => key.id === result.key.id);

  assert.ok(listed);
  assert.equal(listed?.label, "list me");
  assert.equal(listed?.keyPrefix, result.secret.slice(0, 8));
  assert.equal(
    Object.prototype.hasOwnProperty.call(listed ?? {}, "keyHash"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(listed ?? {}, "secret"),
    false
  );
});

run("resets current-month usage while preserving prior months", async () => {
  const currentMonth = getUsageMonth();
  const key = await makeKey({
    label: "reset me",
    monthlyUsageCount: 7,
    usageMonth: currentMonth,
    usageHistory: [
      { month: "2000-01", count: 4 },
      { month: currentMonth, count: 7 },
    ],
  });

  const reset = await resetApiKeyUsage(key._id);

  assert.ok(reset);
  assert.equal(reset?.usage.current, 0);
  assert.equal(reset?.usage.month, currentMonth);
  assert.equal(reset?.usage.total12m, 4);

  const stored = await ApiKey.findById(key._id).lean();

  assert.equal(stored?.usageMonth, currentMonth);
  assert.equal(
    stored?.usageHistory.find((entry) => entry.month === "2000-01")
      ?.count,
    4
  );
  assert.equal(
    stored?.usageHistory.find((entry) => entry.month === currentMonth)
      ?.count,
    0
  );
});

run("disables and re-enables a key", async () => {
  const key = await makeKey({ label: "status me" });

  const disabled = await setApiKeyStatus(key._id, "disabled");

  assert.equal(disabled?.status, "disabled");
  assert.equal(await incrementApiKeyUsage(key._id), false);

  const enabled = await setApiKeyStatus(key._id, "active");

  assert.equal(enabled?.status, "active");
  assert.equal(await incrementApiKeyUsage(key._id), true);
});

run("rejects an invalid status transition", async () => {
  const key = await makeKey();

  await assert.rejects(
    () =>
      setApiKeyStatus(
        key._id,
        "paused" as unknown as "active"
      ),
    (error: unknown) =>
      error instanceof ApiKeyError && error.statusCode === 400
  );
});

run("caps overlong labels at the service boundary", async () => {
  const result = await provisionApiKey({
    label: "x".repeat(80),
  });

  createdKeyIds.push(
    new mongoose.Types.ObjectId(result.key.id)
  );

  assert.equal(result.key.label.length, 64);
});

run("rejects a blank key name at the service boundary", async () => {
  await assert.rejects(
    () => provisionApiKey({ label: "   " }),
    (error: unknown) =>
      error instanceof ApiKeyError &&
      error.statusCode === 400 &&
      error.errorCode === "admin_api_key_invalid_label"
  );
});

run("resets usage on a disabled key without changing status", async () => {
  const currentMonth = getUsageMonth();
  const key = await makeKey({
    status: "disabled",
    monthlyUsageCount: 3,
    usageMonth: currentMonth,
    usageHistory: [{ month: currentMonth, count: 3 }],
  });

  const reset = await resetApiKeyUsage(key._id);

  assert.equal(reset?.status, "disabled");
  assert.equal(reset?.usage.current, 0);
  assert.equal(reset?.usage.total12m, 0);

  const stored = await ApiKey.findById(key._id).lean();

  assert.equal(stored?.status, "disabled");
  assert.equal(stored?.monthlyUsageCount, 0);
});

run("deletes a key permanently and its secret stops authenticating", async () => {
  const { key, secret } = await provisionApiKey({
    label: "delete me",
  });

  createdKeyIds.push(new mongoose.Types.ObjectId(key.id));

  const before = await listApiKeys();

  assert.ok(before.some((listed) => listed.id === key.id));

  const deleted = await deleteApiKey(key.id);

  assert.equal(deleted?.id, key.id);
  assert.equal(deleted?.label, "delete me");
  assert.equal(await ApiKey.findById(key.id).lean(), null);
  assert.equal(
    (await listApiKeys()).some((listed) => listed.id === key.id),
    false
  );

  await assert.rejects(
    () => findAndRolloverApiKey(secret),
    (error: unknown) =>
      error instanceof ApiKeyError && error.statusCode === 401
  );
});

run("deletes a disabled key and returns null for an unknown id", async () => {
  const key = await makeKey({ status: "disabled" });

  const deleted = await deleteApiKey(key._id);

  assert.equal(deleted?.status, "disabled");
  assert.equal(await ApiKey.findById(key._id).lean(), null);
  assert.equal(
    await deleteApiKey(new mongoose.Types.ObjectId()),
    null
  );
});
