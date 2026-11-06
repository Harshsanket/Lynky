import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { createBotIdMiddleware } = await import(
  "../middleware/botid.middleware.js"
);
const { emptyRequestMetrics } = await import(
  "../service/metrics.service.js"
);

const makeRes = () =>
  ({
    statusCode: 200,
    locals: { metrics: emptyRequestMetrics() },
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  }) as any;

test("allows a human request", async () => {
  const middleware = createBotIdMiddleware(async () => ({ isBot: false }));
  const res = makeRes();
  let passed = false;

  await middleware({} as any, res, () => {
    passed = true;
  });

  assert.equal(passed, true);
  assert.equal(res.statusCode, 200);
});

test("blocks a bot request and records the metric", async () => {
  const middleware = createBotIdMiddleware(async () => ({ isBot: true }));
  const res = makeRes();
  let passed = false;

  await middleware({} as any, res, () => {
    passed = true;
  });

  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.locals.metrics.botBlocks, 1);
});

test("fails open when BotID verification errors", async () => {
  const middleware = createBotIdMiddleware(async () => {
    throw new Error("not available");
  });
  const res = makeRes();
  let passed = false;

  await middleware({} as any, res, () => {
    passed = true;
  });

  assert.equal(passed, true);
  assert.equal(res.statusCode, 200);
});
