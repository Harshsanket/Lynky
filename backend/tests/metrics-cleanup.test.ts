import test from "node:test";
import assert from "node:assert/strict";
import type { MetricKeyTtl } from "../service/redis.client.js";

const {
  METRICS_KEY_PATTERN,
  formatMetricCleanupReport,
  isOrphanedMetricTtl,
  runMetricCleanup,
} = await import("../service/metrics-cleanup.service.js");

class FakeMaintenanceStore {
  deletedCalls = 0;
  listCalls = 0;

  constructor(private readonly keys: MetricKeyTtl[]) {}

  async listOrphanedMetricKeys(): Promise<MetricKeyTtl[]> {
    this.listCalls += 1;

    return this.keys;
  }

  async deleteOrphanedMetricKeys(): Promise<number> {
    this.deletedCalls += 1;

    return this.keys.filter((entry) => entry.ttl === -1).length;
  }
}

test("uses the lynky metrics pattern and the TTL == -1 predicate", () => {
  assert.equal(METRICS_KEY_PATTERN, "lynky:metrics:*");
  assert.equal(isOrphanedMetricTtl(-1), true);
  assert.equal(isOrphanedMetricTtl(0), false);
  assert.equal(isOrphanedMetricTtl(7200), false);
});

test("dry-run lists only orphaned keys and deletes nothing", async () => {
  const store = new FakeMaintenanceStore([
    { key: "lynky:metrics:1:/a", ttl: -1 },
    { key: "lynky:metrics:2:/b", ttl: -1 },
    { key: "lynky:metrics:pending_minutes", ttl: 7200 },
  ]);
  const result = await runMetricCleanup(store, { dryRun: true });
  const report = formatMetricCleanupReport(result);

  assert.equal(result.dryRun, true);
  assert.equal(result.deleted, 0);
  assert.deepEqual(
    result.keys.map((entry) => entry.key),
    ["lynky:metrics:1:/a", "lynky:metrics:2:/b"]
  );
  assert.equal(store.deletedCalls, 0);
  assert.match(report, /Orphaned metric keys \(TTL = -1\)/);
  assert.match(report, /lynky:metrics:1:\/a \(ttl -1\)/);
  assert.match(report, /Total: 2\. Dry run: nothing deleted\./);
});

test("execute deletes only orphaned keys and reports the count", async () => {
  const store = new FakeMaintenanceStore([
    { key: "lynky:metrics:1:/a", ttl: -1 },
    { key: "lynky:metrics:pending_minutes", ttl: 7200 },
  ]);
  const result = await runMetricCleanup(store, { dryRun: false });

  assert.equal(result.dryRun, false);
  assert.equal(result.deleted, 1);
  assert.equal(store.listCalls, 0);
  assert.equal(store.deletedCalls, 1);
  assert.equal(
    formatMetricCleanupReport(result),
    `Deleted 1 orphaned metric key(s) matching ${METRICS_KEY_PATTERN}.`
  );
});

test("dry-run reports an empty result cleanly", async () => {
  const store = new FakeMaintenanceStore([]);
  const result = await runMetricCleanup(store, { dryRun: true });

  assert.deepEqual(result.keys, []);
  assert.equal(
    formatMetricCleanupReport(result),
    `No orphaned metric keys found matching ${METRICS_KEY_PATTERN}.`
  );
});
