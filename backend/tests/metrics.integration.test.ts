import test, { after, before } from "node:test";
import assert from "node:assert/strict";

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
const { MemoryCacheStore, setCacheStoreForTests } = await import(
  "../service/redis.client.js"
);
const {
  MetricsDaily,
  MetricsHour,
  MetricsMinute,
  MetricsMonthly,
  ErrorLog,
} = await import("../models/metrics.models.js");
const { AdminSession } = await import(
  "../models/admin-session.models.js"
);
const {
  emptyRequestMetrics,
  flushMetricsForTests,
  getDashboardMetrics,
  recordRequestMetrics,
} = await import("../service/metrics.service.js");

setCacheStoreForTests(new MemoryCacheStore());

const run = testMongoUri ? test : test.skip;
const route = "/test-metrics";
const failureRoute = "/test-short-code-exhausted";

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
});

after(async () => {
  if (!testMongoUri) return;

  await Promise.all([
    MetricsMinute.deleteMany({ route: { $in: [route, failureRoute] } }),
    MetricsHour.deleteMany({
      route: {
        $in: [route, failureRoute, "/api/v1/urls", "/:code"],
      },
    }),
    MetricsDaily.deleteMany({ route: { $in: [route, failureRoute] } }),
    MetricsMonthly.deleteMany({ route: { $in: [route, failureRoute] } }),
    ErrorLog.deleteMany({ route: { $in: [route, failureRoute] } }),
  ]);
  await mongoose.disconnect();
});

const fakeRequest = () =>
  ({
    baseUrl: route,
    route: { path: "" },
  }) as any;

const fakeResponse = (statusCode: number) =>
  ({
    statusCode,
    locals: {
      metrics: emptyRequestMetrics(),
      errorCode: statusCode >= 500 ? "test_error" : undefined,
    },
  }) as any;

run("buffers a request minute and flushes rollups to Mongo", async () => {
  const res = fakeResponse(200);

  res.locals.metrics.cacheHit = 2;
  res.locals.metrics.redisHit = 2;

  await recordRequestMetrics(fakeRequest(), res, 12);

  const minute = Math.floor(Date.now() / 60_000);

  await flushMetricsForTests(minute);

  const doc = await MetricsMinute.findOne({ route }).lean();

  assert.equal(doc?.requests, 1);
  assert.equal(doc?.success, 1);
  assert.equal(doc?.cacheHit, 2);
  assert.equal(doc?.redisHit, 2);
  assert.equal(doc?.latencySum, 12);
  assert.equal(doc?.latencyCount, 1);
  assert.ok(doc?.expireAt instanceof Date);

  assert.ok(await MetricsHour.findOne({ route }).lean());
  assert.ok(await MetricsDaily.findOne({ route }).lean());
  assert.ok(await MetricsMonthly.findOne({ route }).lean());
});

run("writes an ErrorLog for 5xx responses", async () => {
  await recordRequestMetrics(fakeRequest(), fakeResponse(500), 5);

  const error = await ErrorLog.findOne({ route }).lean();

  assert.equal(error?.status, 500);
  assert.equal(error?.errorCode, "test_error");
  assert.ok(error?.expireAt instanceof Date);
});

run("counts short-code exhaustion and records its error code", async () => {
  const res = {
    statusCode: 503,
    locals: {
      metrics: emptyRequestMetrics(),
      errorCode: "short_code_exhausted",
    },
  } as any;

  res.locals.metrics.shortCodeExhausted = 2;

  await recordRequestMetrics(
    { baseUrl: failureRoute, route: { path: "" } } as any,
    res,
    10
  );

  const minute = Math.floor(Date.now() / 60_000);

  await flushMetricsForTests(minute);

  const doc = await MetricsMinute.findOne({ route: failureRoute }).lean();

  assert.equal(doc?.shortCodeExhausted, 2);
  assert.equal(doc?.status5xx, 1);

  const error = await ErrorLog.findOne({
    route: failureRoute,
    errorCode: "short_code_exhausted",
  }).lean();

  assert.ok(error);
});

run("declares the expected TTL indexes", async () => {
  const minuteIndexes = await MetricsMinute.collection.indexes();
  const hourIndexes = await MetricsHour.collection.indexes();
  const dailyIndexes = await MetricsDaily.collection.indexes();
  const monthlyIndexes = await MetricsMonthly.collection.indexes();
  const errorIndexes = await ErrorLog.collection.indexes();
  const sessionIndexes = await AdminSession.collection.indexes();

  const ttl = (indexes: any[], name: string) => {
    const index = indexes.find((entry) => entry.name === name);

    assert.ok(index, `missing ${name}`);
    assert.equal(index.expireAfterSeconds, 0);
  };

  ttl(minuteIndexes, "expireAt_1");
  ttl(hourIndexes, "expireAt_1");
  ttl(errorIndexes, "expireAt_1");
  ttl(sessionIndexes, "expiresAt_1");

  assert.equal(
    dailyIndexes.some((entry) => entry.name === "expireAt_1"),
    false
  );
  assert.equal(
    monthlyIndexes.some((entry) => entry.name === "expireAt_1"),
    false
  );
});

run("reports separate create and redirect latency", async () => {
  const now = new Date();

  await MetricsHour.deleteMany({
    route: { $in: ["/api/v1/urls", "/:code"] },
  });

  await MetricsHour.create({
    route: "/api/v1/urls",
    windowStart: now,
    latencySum: 100,
    latencyCount: 10,
    minMs: 5,
    maxMs: 20,
  });
  await MetricsHour.create({
    route: "/:code",
    windowStart: now,
    latencySum: 50,
    latencyCount: 10,
    minMs: 2,
    maxMs: 9,
  });

  const metrics = await getDashboardMetrics();

  assert.deepEqual(metrics.latency.create, {
    avgMs: 10,
    minMs: 5,
    maxMs: 20,
  });
  assert.deepEqual(metrics.latency.redirect, {
    avgMs: 5,
    minMs: 2,
    maxMs: 9,
  });
});
