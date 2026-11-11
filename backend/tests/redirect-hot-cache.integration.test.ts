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
process.env.HOT_VISIT_THRESHOLD = "2";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { Link } = await import("../models/link.models.js");
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { getCachedLink } = await import(
  "../service/link-cache.service.js"
);
const { decryptUrl, encryptUrl } = await import(
  "../service/encryption.service.js"
);
const { hashCode } = await import("../service/code-hash.service.js");
const { hashUrl } = await import("../service/url-hasher.service.js");
const { env } = await import("../src/config/env.js");
const { redirectToOriginalUrl } = await import(
  "../controller/redirect.controller.js"
);
const { flushBackgroundTasksForTests } = await import(
  "../src/utils/background.js"
);

const run = testMongoUri ? test : test.skip;
const code = crypto.randomBytes(3).toString("hex");
const destination = "https://example.com/hot-cache";
const ciphertext = encryptUrl(destination);

const makeResponse = (): any => ({
  locals: {},
  statusCode: 200,
  redirectUrl: null,
  headers: {},

  setHeader(name: string, value: string) {
    this.headers[name] = value;
    return this;
  },

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  },

  json(body: unknown) {
    this.body = body;
    return this;
  },

  redirect(statusCode: number, url: string) {
    this.statusCode = statusCode;
    this.redirectUrl = url;
    return this;
  },
});

const request = {
  params: { code },
  headers: {},
  method: "GET",
  path: `/${code}`,
} as any;

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await Link.deleteMany({ codeHash: hashCode(code) });
  await Link.create({
    codeHash: hashCode(code),
    originalUrl: ciphertext,
    urlHash: hashUrl(`${destination}#${code}`),
    expiresAt: new Date(Date.now() + 60_000),
  });
});

after(async () => {
  if (!testMongoUri) return;

  await Link.deleteMany({ codeHash: hashCode(code) });
  await mongoose.disconnect();
});

run("promotes ciphertext and serves the next redirect from cache", async () => {
  setCacheStoreForTests(new MemoryCacheStore());

  const originalFindOne = Link.findOne.bind(Link);
  let findOneCalls = 0;

  (Link as any).findOne = (...args: any[]) => {
    findOneCalls += 1;
    return (originalFindOne as any)(...args);
  };

  try {
    for (let hit = 0; hit < env.HOT_VISIT_THRESHOLD; hit++) {
      const res = makeResponse();

      await redirectToOriginalUrl(request, res);
      await flushBackgroundTasksForTests();

      assert.equal(res.statusCode, 302);
      assert.equal(res.redirectUrl, destination);
    }

    const cached = await getCachedLink(code);

    assert.ok(cached);
    assert.equal(cached.originalUrl, ciphertext);
    assert.equal(decryptUrl(cached.originalUrl), destination);

    const callsBeforeHotHit = findOneCalls;
    const hotRes = makeResponse();

    await redirectToOriginalUrl(request, hotRes);
    await flushBackgroundTasksForTests();

    assert.equal(hotRes.statusCode, 302);
    assert.equal(hotRes.redirectUrl, destination);
    assert.equal(findOneCalls, callsBeforeHotHit);
  } finally {
    (Link as any).findOne = originalFindOne;
  }
});
