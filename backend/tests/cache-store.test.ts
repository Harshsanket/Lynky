import test, { mock } from "node:test";
import assert from "node:assert/strict";
import type { RecordMinuteMetricsInput } from "../service/redis.client.js";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { MemoryCacheStore, MINUTE_METRIC_FIELDS, normalizeHash } =
  await import("../service/redis.client.js");

test("getHashAndDelete returns and removes all fields", async () => {
  const store = new MemoryCacheStore();

  await store.hSet("pending", "attempts", "3");
  await store.hSet("pending", "success", "2");

  assert.deepEqual(await store.getHashAndDelete("pending"), {
    attempts: "3",
    success: "2",
  });
  assert.deepEqual(await store.hGetAll("pending"), {});
});

test("setNx only acquires an unused or expired key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.setNx("lock", "first", 60), true);
  assert.equal(await store.setNx("lock", "second", 60), false);
  assert.equal(await store.get("lock"), "first");

  await store.del("lock");

  assert.equal(await store.setNx("lock", "third", 60), true);
  assert.equal(await store.get("lock"), "third");
});

test("incrBy keeps incrementing an existing key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.incrBy("counter", 1, 60), 1);
  assert.equal(await store.incrBy("counter", 1, 60), 2);
  assert.equal(await store.get("counter"), "2");
});

test("incrBy applies a TTL to an existing key without one", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const store = new MemoryCacheStore();

    await store.set("counter", "1");

    assert.equal(await store.incrBy("counter", 1, 60), 2);

    mock.timers.tick(60_001);

    assert.equal(await store.get("counter"), null);
  } finally {
    mock.timers.reset();
  }
});

test("incrByWithTtl returns the count and remaining window", async () => {
  const store = new MemoryCacheStore();

  const first = await store.incrByWithTtl("window", 1, 60);
  const second = await store.incrByWithTtl("window", 1, 60);

  assert.equal(first.count, 1);
  assert.equal(second.count, 2);
  assert.ok(second.ttlMs > 59_000);
  assert.ok(second.ttlMs <= 60_000);
});

test("decrByIfExists does not create a missing key", async () => {
  const store = new MemoryCacheStore();

  assert.equal(await store.decrByIfExists("missing", 1), null);
  assert.equal(await store.get("missing"), null);

  await store.incrBy("present", 2, 60);

  assert.equal(await store.decrByIfExists("present", 1), 1);
  assert.equal(await store.get("present"), "1");
});

test("delIfEquals only deletes the matching value", async () => {
  const store = new MemoryCacheStore();

  await store.set("lock", "token-a", 60);

  assert.equal(await store.delIfEquals("lock", "token-b"), false);
  assert.equal(await store.get("lock"), "token-a");

  assert.equal(await store.delIfEquals("lock", "token-a"), true);
  assert.equal(await store.get("lock"), null);
});

test("normalizeHash accepts flat arrays and objects, and rejects junk", () => {
  assert.deepEqual(normalizeHash(["a", "1", "b", "2"]), {
    a: "1",
    b: "2",
  });
  assert.deepEqual(normalizeHash({ a: 1, b: "2" }), {
    a: "1",
    b: "2",
  });
  assert.deepEqual(normalizeHash(null), {});
  assert.deepEqual(normalizeHash({}), {});
  assert.deepEqual(normalizeHash(["a"]), {});
  assert.deepEqual(normalizeHash(42), {});
});

const minuteInput = (
  overrides: Partial<RecordMinuteMetricsInput> = {}
): RecordMinuteMetricsInput => ({
  key: "metrics:100:/test",
  pendingKey: "metrics:pending_minutes",
  routesKey: "metrics:minute_routes:100",
  ttlSeconds: 7200,
  epoch: "100",
  route: "/test",
  durationMs: 12,
  fields: { requests: 1 },
  ...overrides,
});

test("recordMinuteMetrics writes every whitelisted field and both sets", async () => {
  const store = new MemoryCacheStore();
  const fields = Object.fromEntries(
    MINUTE_METRIC_FIELDS.map((field) => [field, 1])
  );
  const input = minuteInput({ fields });

  await store.recordMinuteMetrics(input);

  const hash = await store.hGetAll(input.key);

  for (const field of MINUTE_METRIC_FIELDS) {
    assert.equal(hash[field], "1", field);
  }

  assert.equal(hash.minMs, "12");
  assert.equal(hash.maxMs, "12");
  assert.deepEqual(await store.sMembers(input.pendingKey), ["100"]);
  assert.deepEqual(await store.sMembers(input.routesKey), ["/test"]);
});

test("recordMinuteMetrics keeps min/max improvements only", async () => {
  const store = new MemoryCacheStore();
  const input = minuteInput();

  await store.recordMinuteMetrics(input);
  await store.recordMinuteMetrics({ ...input, durationMs: 5 });
  await store.recordMinuteMetrics({ ...input, durationMs: 20 });
  await store.recordMinuteMetrics({ ...input, durationMs: 10 });

  const hash = await store.hGetAll(input.key);

  assert.equal(hash.requests, "4");
  assert.equal(hash.minMs, "5");
  assert.equal(hash.maxMs, "20");
});

test("recordMinuteMetrics applies the TTL to the hash and both sets", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const store = new MemoryCacheStore();
    const input = minuteInput();

    await store.recordMinuteMetrics(input);

    assert.equal((await store.hGetAll(input.key)).requests, "1");
    assert.deepEqual(await store.sMembers(input.pendingKey), ["100"]);
    assert.deepEqual(await store.sMembers(input.routesKey), ["/test"]);

    mock.timers.tick(7_200_001);

    assert.deepEqual(await store.hGetAll(input.key), {});
    assert.deepEqual(await store.sMembers(input.pendingKey), []);
    assert.deepEqual(await store.sMembers(input.routesKey), []);
  } finally {
    mock.timers.reset();
  }
});

test("recordMinuteMetrics rejects invalid fields and deltas before writing", async () => {
  const store = new MemoryCacheStore();

  await assert.rejects(
    () =>
      store.recordMinuteMetrics(
        minuteInput({ fields: { bogus: 1 } })
      ),
    /unexpected minute metric field/
  );
  await assert.rejects(
    () =>
      store.recordMinuteMetrics(
        minuteInput({ fields: { requests: 1.5 } })
      ),
    /invalid minute metric delta/
  );
  await assert.rejects(
    () =>
      store.recordMinuteMetrics(minuteInput({ durationMs: -1 })),
    /invalid minute metric duration/
  );

  assert.deepEqual(await store.hGetAll("metrics:100:/test"), {});
  assert.deepEqual(
    await store.sMembers("metrics:pending_minutes"),
    []
  );
  assert.deepEqual(
    await store.sMembers("metrics:minute_routes:100"),
    []
  );
});
