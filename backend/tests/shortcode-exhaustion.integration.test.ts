import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-shortcode-exhaustion$1")
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.MIN_CODE_LENGTH = "1";
process.env.MAX_CODE_LENGTH = "1";
process.env.MAX_CODE_ATTEMPTS = "1";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { Link } = await import("../models/link.models.js");
const { BASE62_ALPHABET } = await import(
  "../service/shortcode-generater.service.js"
);
const { hashCode } = await import("../service/code-hash.service.js");
const { encryptUrl } = await import("../service/encryption.service.js");
const { hashUrl } = await import("../service/url-hasher.service.js");
const {
  ShortCodeExhaustedError,
  createShortUrlFromPrepared,
} = await import("../service/url.service.js");

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;
const cleanedUrl = "https://example.com/shortcode-exhaustion";
const urlHash = hashUrl(cleanedUrl);

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Link.deleteMany({ urlHash: { $regex: /^seed-/ } });

  const expiresAt = new Date(Date.now() + 60_000);

  await Link.collection.insertMany(
    [...BASE62_ALPHABET].map((code, index) => ({
      codeHash: hashCode(code),
      originalUrl: encryptUrl(`https://example.com/seed-${index}`),
      urlHash: `seed-${index}`,
      expiresAt,
      createdAt: new Date(),
      visitCount: 0,
      lastVisitedAt: null,
    }))
  );
});

after(async () => {
  if (!testMongoUri) return;

  await Link.deleteMany({
    $or: [{ urlHash }, { urlHash: { $regex: /^seed-/ } }],
  });
  await mongoose.disconnect();
});

run(
  "exhausting MAX_CODE_ATTEMPTS raises a clean 503 error",
  async () => {
    await assert.rejects(
      () =>
        createShortUrlFromPrepared({
          cleanedUrl,
          urlHash,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ShortCodeExhaustedError);
        assert.equal(error.statusCode, 503);
        return true;
      }
    );

    assert.equal(await Link.countDocuments({ urlHash }), 0);
  }
);
