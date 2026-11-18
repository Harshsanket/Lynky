import "dotenv/config";
import {
  getMetricMaintenanceStore,
  initializeCache,
} from "../service/redis.client.js";
import {
  formatMetricCleanupReport,
  runMetricCleanup,
} from "../service/metrics-cleanup.service.js";

/**
 * Remove only `lynky:metrics:*` keys whose TTL is exactly -1 (no expiry).
 * Live metric keys all carry a TTL, so the predicate protects them. Safe to
 * re-run: a second run deletes 0.
 *
 * Usage:
 *   npm run metrics:cleanup -- --dry-run
 *   npm run metrics:cleanup -- --execute
 */
const knownFlags = new Set(["--dry-run", "--execute"]);
const unknown = process.argv
  .slice(2)
  .filter((arg) => !knownFlags.has(arg));

if (unknown.length > 0) {
  console.error(`Unknown flag(s): ${unknown.join(", ")}`);
  console.error("Use --dry-run or --execute.");
  process.exitCode = 1;
} else {
  const dryRun = !process.argv.includes("--execute");

  const run = async () => {
    await initializeCache();

    const store = getMetricMaintenanceStore();

    if (!store) {
      console.error(
        "Upstash Redis is required for this maintenance script; refusing to run against the memory fallback."
      );
      process.exitCode = 1;
      return;
    }

    const result = await runMetricCleanup(store, { dryRun });

    console.log(formatMetricCleanupReport(result));
  };

  run().catch((error) => {
    console.error(
      "Metric cleanup failed:",
      (error as Error)?.message ?? String(error)
    );
    process.exitCode = 1;
  });
}
