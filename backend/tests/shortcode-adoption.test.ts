import test, { after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { Link } = await import("../models/link.models.js");
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { createShortUrlFromPrepared } = await import(
  "../service/url.service.js"
);
const { hashCode, generateCodeSalt, deriveCodeFromSalt } = await import(
  "../service/code-hash.service.js"
);
const { encryptUrl } = await import("../service/encryption.service.js");
const { hashUrl } = await import("../service/url-hasher.service.js");

setCacheStoreForTests(new MemoryCacheStore());

const cleanedUrl = "https://example.com/adoption-race";
const urlHash = hashUrl(cleanedUrl);
const codeSalt = generateCodeSalt();
const expectedCode = deriveCodeFromSalt(urlHash, codeSalt);
const expiresAt = new Date(Date.now() + 60_000);
const row = {
  _id: "row-1",
  codeHash: hashCode(expectedCode),
  codeSalt,
  originalUrl: encryptUrl(cleanedUrl),
  urlHash,
  expiresAt,
  createdAt: new Date(),
  visitCount: 0,
  lastVisitedAt: null,
};

const originalFindOne = Link.findOne;
const originalFindByIdAndUpdate = Link.findByIdAndUpdate;
const originalCreate = Link.create;

after(() => {
  Link.findOne = originalFindOne;
  Link.findByIdAndUpdate = originalFindByIdAndUpdate;
  Link.create = originalCreate;
});

test("adopts a same-url winner when the duplicate index is unknown", async () => {
  let createCalls = 0;

  Link.findOne = ((filter: Record<string, unknown>) => ({
    lean: async () => ("expiresAt" in filter ? null : row),
  })) as any;

  Link.findByIdAndUpdate = (() => ({
    lean: async () => ({ ...row, expiresAt }),
  })) as any;

  Link.create = (async () => {
    createCalls += 1;

    const error: any = new Error(
      "E11000 duplicate key error collection: test.links"
    );
    error.code = 11000;

    throw error;
  }) as any;

  const result = await createShortUrlFromPrepared({
    cleanedUrl,
    urlHash,
  });

  assert.equal(result.created, false);
  assert.equal(result.code, expectedCode);
  assert.equal(createCalls, 1);
});
