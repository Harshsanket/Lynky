import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-link-index-test$1")
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
const { Link } = await import("../models/link.models.js");
const { assertLinkIndexesReady } = await import(
  "../service/link-index.service.js"
);

const run = testMongoUri ? test : test.skip;

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Link.collection.drop().catch(() => undefined);
});

after(async () => {
  if (!testMongoUri) return;

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

run("repairs a non-sparse legacy code index", async () => {
  await Link.collection.createIndex(
    { code: 1 },
    { name: "legacy_code_unique", unique: true }
  );

  await assertLinkIndexesReady();

  const indexes = await Link.collection.indexes();
  const codeIndex = indexes.find(
    (index) => index.key && (index.key as Record<string, unknown>).code === 1
  );

  assert.equal(codeIndex?.name, "code_1");
  assert.equal(codeIndex?.sparse, true);
});
