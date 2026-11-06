import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(/\/[^/?]+(\?.*)?$/, "/lynky-test-report$1")
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
const { TestReport } = await import(
  "../models/test-report.models.js"
);
const { getLatestTestReport, saveTestReport } = await import(
  "../service/test-report.service.js"
);

const run = testMongoUri ? test : test.skip;

before(async () => {
  if (!testMongoUri) return;

  await connectDatabase();
  await TestReport.deleteMany({ runId: { $regex: /^test-report-/ } });
});

after(async () => {
  if (!testMongoUri) return;

  await TestReport.deleteMany({ runId: { $regex: /^test-report-/ } });
  await mongoose.disconnect();
});

run("stores one report per run and returns the latest", async () => {
  const base = {
    label: "test",
    finishedAt: new Date(),
    durationSeconds: 1,
    status: "completed" as const,
    environment: {},
    config: {},
    dataset: {},
    phases: {},
    latency: {},
    collisions: {},
    failures: {},
    redirects: {},
    storage: {},
    failSafes: [],
    security: {},
    telemetry: {},
    artifacts: {},
    notes: [],
  };

  await saveTestReport({
    ...base,
    runId: "test-report-old",
    startedAt: new Date(Date.now() - 60_000),
  });
  await saveTestReport({
    ...base,
    runId: "test-report-new",
    startedAt: new Date(),
  });

  const latest = await getLatestTestReport();

  assert.equal(latest?.runId, "test-report-new");
});
