import type {
  MetricKeyTtl,
  MetricMaintenanceStore,
} from "./redis.client.js";

/**
 * Maintenance-only cleanup for metric hashes that predate the atomic TTL
 * write. The production keys use the `lynky:` prefix added by the cache store;
 * this helper talks to raw Redis and therefore includes it.
 */
export const METRICS_KEY_PATTERN = "lynky:metrics:*";

/** The exact orphan predicate: only keys with no TTL are eligible. */
export const isOrphanedMetricTtl = (ttl: number): boolean =>
  ttl === -1;

export interface MetricCleanupResult {
  dryRun: boolean;
  keys: MetricKeyTtl[];
  deleted: number;
}

export const runMetricCleanup = async (
  store: MetricMaintenanceStore,
  options: { dryRun: boolean }
): Promise<MetricCleanupResult> => {
  if (options.dryRun) {
    const keys = (
      await store.listOrphanedMetricKeys(METRICS_KEY_PATTERN)
    ).filter((entry) => isOrphanedMetricTtl(entry.ttl));

    return { dryRun: true, keys, deleted: 0 };
  }

  const deleted = await store.deleteOrphanedMetricKeys(
    METRICS_KEY_PATTERN
  );

  return { dryRun: false, keys: [], deleted };
};

export const formatMetricCleanupReport = (
  result: MetricCleanupResult
): string => {
  if (!result.dryRun) {
    return `Deleted ${result.deleted} orphaned metric key(s) matching ${METRICS_KEY_PATTERN}.`;
  }

  if (result.keys.length === 0) {
    return `No orphaned metric keys found matching ${METRICS_KEY_PATTERN}.`;
  }

  return [
    `Orphaned metric keys (TTL = -1) matching ${METRICS_KEY_PATTERN}:`,
    ...result.keys.map(
      (entry) => `  ${entry.key} (ttl ${entry.ttl})`
    ),
    `Total: ${result.keys.length}. Dry run: nothing deleted.`,
  ].join("\n");
};
