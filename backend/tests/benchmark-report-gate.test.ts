import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.FRONTEND_URL = "https://lynky.test";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.EXPIRATION_DAYS = "30";
process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

const { adminBenchmarkReportController } = await import(
  "../controller/admin.controller.js"
);

test("production hides the benchmark report route behind the generic 404", async () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  await adminBenchmarkReportController({} as any, res as any);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    message: "Not found",
  });
});
