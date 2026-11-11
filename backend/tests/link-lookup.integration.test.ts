import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const testMongoUri = process.env.TEST_MONGODB_URI;

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
const { encryptUrl } = await import("../service/encryption.service.js");
const { findLinkForRedirect } = await import(
  "../service/link-lookup.service.js"
);

const run = testMongoUri ? test : test.skip;
const createdHashes: string[] = [];

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
});

after(async () => {
  if (!testMongoUri) return;

  await Link.deleteMany({ urlHash: { $in: createdHashes } });
  await mongoose.disconnect();
});

run("ignores a legacy plaintext-only row", async () => {
  const code = crypto.randomBytes(4).toString("hex").slice(0, 6);
  const urlHash = `${crypto.randomBytes(32).toString("hex")}`;

  createdHashes.push(urlHash);

  await Link.collection.insertOne({
    code,
    originalUrl: encryptUrl("https://example.com/legacy"),
    urlHash,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });

  assert.equal(await findLinkForRedirect(code), null);
});

run("returns null for a missing code", async () => {
  assert.equal(await findLinkForRedirect("missing"), null);
});
