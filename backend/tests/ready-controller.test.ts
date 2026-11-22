import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const mongoose = (await import("mongoose")).default;
const { createReadyController } = await import(
  "../controller/health.controller.js"
);

const runtime = {
  artifacts: {
    manifest: {
      artifactVersion: "test-config",
      validatorVersion: "1",
    },
  },
  blocklist: {
    getState: () => ({ status: "ok", decision: "allow" }),
  },
};

const cache = {
  configured: false,
  available: true,
  mode: "memory" as const,
};

const setReadyState = (value: number): void => {
  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value,
  });
};

const fakeResponse = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
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

const controller = (connectDatabase: () => Promise<unknown>) =>
  createReadyController({
    connectDatabase,
    getRuntime: () => runtime,
    getCacheStatus: () => cache,
  });

test("readyState 1 returns ready without attempting a connection", async () => {
  setReadyState(1);

  let calls = 0;
  const res = fakeResponse();

  await controller(async () => {
    calls += 1;
  })({} as any, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls, 0);
  assert.equal(res.body.status, "ready");
  assert.equal(res.body.db.status, "ok");
  assert.equal(res.body.version, "test-config");
});

test("response shape matches the existing readiness contract", async () => {
  setReadyState(1);

  const res = fakeResponse();

  await controller(async () => {})({} as any, res);

  assert.deepEqual(Object.keys(res.body).sort(), [
    "blocklist",
    "cache",
    "config",
    "db",
    "requestId",
    "status",
    "timestamp",
    "version",
  ]);
  assert.deepEqual(res.body.config, {
    status: "ok",
    artifactVersion: "test-config",
    validatorVersion: "1",
  });
  assert.deepEqual(res.body.blocklist, {
    status: "ok",
    decision: "allow",
  });
  assert.deepEqual(res.body.cache, cache);
});

test("readyState 0 connects and reports ready", async () => {
  setReadyState(0);

  let calls = 0;
  const res = fakeResponse();

  await controller(async () => {
    calls += 1;
    setReadyState(1);
  })({} as any, res);

  assert.equal(calls, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ready");
  assert.equal(res.body.db.status, "ok");
});

test("readyState 0 with a failed connect reports degraded", async () => {
  setReadyState(0);

  const res = fakeResponse();

  await controller(async () => {
    throw new Error("database down");
  })({} as any, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, "degraded");
  assert.equal(res.body.db.status, "unavailable");
});

test("a hanging connect is capped at 3 seconds", async () => {
  setReadyState(0);

  const res = fakeResponse();
  const startedAt = Date.now();

  await controller(() => new Promise(() => {}))({} as any, res);

  const elapsed = Date.now() - startedAt;

  assert.ok(elapsed >= 2900, `elapsed ${elapsed}ms`);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, "degraded");
  assert.equal(res.body.db.status, "unavailable");
});

test("concurrent probes share one connection attempt", async () => {
  setReadyState(0);

  let calls = 0;
  let resolveConnect: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    resolveConnect = resolve;
  });
  const connect = async () => {
    calls += 1;
    await pending;
    setReadyState(1);
  };
  const first = fakeResponse();
  const second = fakeResponse();
  const ready = controller(connect);

  const one = ready({} as any, first);
  const two = ready({} as any, second);

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 1);

  resolveConnect?.();

  await Promise.all([one, two]);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.db.status, "ok");
  assert.equal(second.body.db.status, "ok");
});
