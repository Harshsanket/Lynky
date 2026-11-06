import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createPasswordHash } from "../src/utils/admin-password.js";

const testMongoUri = process.env.TEST_MONGODB_URI;
const password = "CorrectHorseBattery1!";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.SYSADMIN_ENABLED = "true";
process.env.SYSADMIN_USERNAME = "ops.a";
process.env.SYSADMIN_PASSWORD_HASH = createPasswordHash(password);

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import(
  "../database/index.database.js"
);
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const { AdminSession } = await import(
  "../models/admin-session.models.js"
);
const {
  ADMIN_SESSION_ABSOLUTE_MS,
  AdminAuthError,
  deleteAdminSession,
  getAdminSession,
  loginAdmin,
} = await import("../service/admin-auth.service.js");
const { adminLoginController } = await import(
  "../controller/admin.controller.js"
);

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await AdminSession.deleteMany({});
});

after(async () => {
  if (!testMongoUri) return;

  await AdminSession.deleteMany({});
  await mongoose.disconnect();
});

run("creates, reads, slides, and deletes a Mongo session", async () => {
  const result = await loginAdmin("ops.a", password, "127.0.0.1");

  assert.equal(result.username, "ops.a");
  assert.ok(result.sessionId.length >= 32);
  assert.ok(result.csrfToken.length >= 32);

  const session = await getAdminSession(result.sessionId);

  assert.ok(session);
  assert.equal(session?.csrfToken, result.csrfToken);
  assert.ok(session?.createdAt instanceof Date);
  assert.ok(session?.lastSeenAt instanceof Date);
  assert.ok(
    session!.expiresAt.getTime() <=
      session!.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_MS
  );

  await deleteAdminSession(result.sessionId);

  assert.equal(await getAdminSession(result.sessionId), null);
});

run("locks out after three failed attempts", async () => {
  const ip = "10.0.0.2";
  const before = await AdminSession.countDocuments({});

  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(
      () => loginAdmin("ops.a", "WrongPassword1!", ip),
      (error: unknown) =>
        error instanceof AdminAuthError && error.statusCode === 401
    );
  }

  await assert.rejects(
    () => loginAdmin("ops.a", password, ip),
    (error: unknown) =>
      error instanceof AdminAuthError && error.statusCode === 401
  );

  assert.equal(await AdminSession.countDocuments({}), before);
});

run("uses the same generic error for an invalid username format", async () => {
  await assert.rejects(
    () => loginAdmin("Bad Name", password, "10.0.0.3"),
    (error: unknown) =>
      error instanceof AdminAuthError &&
      error.message === "Invalid credentials."
  );
});

run("login response marks the session as authenticated", async () => {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    cookieCall: undefined as any,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    cookie(name: string, value: string, options: unknown) {
      this.cookieCall = { name, value, options };
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  await adminLoginController(
    {
      body: { username: "ops.a", password },
      ip: "10.0.0.4",
      socket: {},
    } as any,
    response as any
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.authenticated, true);
  assert.equal(response.body.data.username, "ops.a");
  assert.ok(response.cookieCall?.value);
  assert.equal(
    response.cookieCall?.options.maxAge,
    ADMIN_SESSION_ABSOLUTE_MS
  );
});
