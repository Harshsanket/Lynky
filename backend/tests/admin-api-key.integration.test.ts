import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createPasswordHash } from "../src/utils/admin-password.js";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(
      /\/[^/?]+(\?.*)?$/,
      "/lynky-admin-api-key$1"
    )
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.SYSADMIN_USERNAME = "ops.a";
process.env.SYSADMIN_PASSWORD_HASH = createPasswordHash("CorrectHorse1!");

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { ApiKey } = await import("../models/api-key.models.js");
const { AdminSession } = await import(
  "../models/admin-session.models.js"
);
const {
  ADMIN_SESSION_COOKIE,
  loginAdmin,
} = await import("../service/admin-auth.service.js");
const {
  adminApiKeysController,
  adminCreateApiKeyController,
  adminDisableApiKeyController,
  adminEnableApiKeyController,
  adminResetApiKeyUsageController,
} = await import("../controller/admin.controller.js");

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;
let session: Awaited<ReturnType<typeof loginAdmin>>;

const fakeResponse = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    locals: {},
    setHeader: () => undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return res;
};

const fakeRequest = (
  options: {
    session?: Awaited<ReturnType<typeof loginAdmin>>;
    csrf?: string;
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
) => {
  const headers: Record<string, string> = {};

  if (options.session) {
    headers.cookie = `${ADMIN_SESSION_COOKIE}=${options.session.sessionId}`;
  }

  return {
    headers,
    body: options.body ?? {},
    params: options.params ?? {},
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    header(name: string) {
      if (name.toLowerCase() === "x-csrf-token") {
        return options.csrf;
      }

      return headers[name.toLowerCase()];
    },
  } as any;
};

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await AdminSession.deleteMany({});
  session = await loginAdmin("ops.a", "CorrectHorse1!", "127.0.0.1");
});

after(async () => {
  if (!testMongoUri) return;

  await ApiKey.deleteMany({ label: /^admin-api-key-test/ });
  await AdminSession.deleteMany({});
  await mongoose.disconnect();
});

run("rejects API-key management without a session", async () => {
  const res = fakeResponse();

  await adminApiKeysController(fakeRequest(), res);

  assert.equal(res.statusCode, 401);
});

run("rejects mutating API-key calls without CSRF", async () => {
  const res = fakeResponse();

  await adminCreateApiKeyController(
    fakeRequest({ session, body: { label: "admin-api-key-test" } }),
    res
  );

  assert.equal(res.statusCode, 403);
});

run("generates a key once, lists it redacted, and manages status", async () => {
  const createRes = fakeResponse();

  await adminCreateApiKeyController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      body: { label: "admin-api-key-test created" },
    }),
    createRes
  );

  assert.equal(createRes.statusCode, 201);
  assert.equal(typeof createRes.body.data.secret, "string");
  assert.equal(
    createRes.body.data.key.keyPrefix,
    createRes.body.data.secret.slice(0, 8)
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      createRes.body.data.key,
      "keyHash"
    ),
    false
  );

  const keyId = createRes.body.data.key.id;
  const listRes = fakeResponse();

  await adminApiKeysController(
    fakeRequest({ session }),
    listRes
  );

  assert.equal(listRes.statusCode, 200);
  const listed = listRes.body.data.keys.find(
    (key: { id: string }) => key.id === keyId
  );

  assert.ok(listed);
  assert.equal(
    Object.prototype.hasOwnProperty.call(listed, "keyHash"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(listed, "secret"),
    false
  );

  const resetRes = fakeResponse();

  await adminResetApiKeyUsageController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      params: { id: keyId },
    }),
    resetRes
  );

  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.body.data.key.usage.current, 0);

  const disableRes = fakeResponse();

  await adminDisableApiKeyController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      params: { id: keyId },
    }),
    disableRes
  );

  assert.equal(disableRes.statusCode, 200);
  assert.equal(disableRes.body.data.key.status, "disabled");

  const enableRes = fakeResponse();

  await adminEnableApiKeyController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      params: { id: keyId },
    }),
    enableRes
  );

  assert.equal(enableRes.statusCode, 200);
  assert.equal(enableRes.body.data.key.status, "active");

  const stored = await ApiKey.findById(keyId).lean();

  assert.equal(stored?.status, "active");
  assert.equal(stored?.label, "admin-api-key-test created");

  await ApiKey.deleteOne({ _id: keyId });
});

run("rejects invalid labels and ids", async () => {
  const labelRes = fakeResponse();

  await adminCreateApiKeyController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      body: { label: "x".repeat(65) },
    }),
    labelRes
  );

  assert.equal(labelRes.statusCode, 400);

  const idRes = fakeResponse();

  await adminResetApiKeyUsageController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      params: { id: "not-an-object-id" },
    }),
    idRes
  );

  assert.equal(idRes.statusCode, 400);
});

run("returns 404 for an unknown API key id", async () => {
  const res = fakeResponse();

  await adminResetApiKeyUsageController(
    fakeRequest({
      session,
      csrf: session.csrfToken,
      params: { id: new mongoose.Types.ObjectId().toString() },
    }),
    res
  );

  assert.equal(res.statusCode, 404);
});
