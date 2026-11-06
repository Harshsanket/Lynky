import type { Request, Response } from "express";
import { env } from "../src/config/env.js";
import {
  ErrorLog,
  MetricsDaily,
  MetricsHour,
  MetricsMinute,
  MetricsMonthly,
} from "../models/metrics.models.js";
import { getRequestContext } from "./request-context.service.js";
import { getCacheStore } from "./redis.client.js";
import { getStatsSnapshot } from "./stats.service.js";
import { logWarn } from "./logger.js";

export interface RequestMetricFields {
  cacheHit: number;
  cacheMiss: number;
  redisHit: number;
  redisMiss: number;
  mongoCalls: number;
  redisCalls: number;
  botBlocks: number;
  authFailures: number;
}

export const emptyRequestMetrics = (): RequestMetricFields => ({
  cacheHit: 0,
  cacheMiss: 0,
  redisHit: 0,
  redisMiss: 0,
  mongoCalls: 0,
  redisCalls: 0,
  botBlocks: 0,
  authFailures: 0,
});

export const markRequestMetric = (
  res: Response,
  field: keyof RequestMetricFields,
  amount = 1
): void => {
  const metrics = res.locals.metrics as
    | RequestMetricFields
    | undefined;

  if (metrics) {
    metrics[field] += amount;
  }
};

export const setMetricErrorCode = (
  res: Response,
  errorCode: string
): void => {
  res.locals.errorCode = errorCode;
};

const MINUTE_MS = 60_000;
const FLUSH_THROTTLE_MS = 5_000;
const METRIC_TTL_SECONDS = 2 * 60 * 60;
const MINUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const ROLLUP_FIELDS = [
  "requests",
  "success",
  "failed",
  "status4xx",
  "status5xx",
  "status429",
  "cacheHit",
  "cacheMiss",
  "redisHit",
  "redisMiss",
  "mongoCalls",
  "redisCalls",
  "latencySum",
  "latencyCount",
  "errorCount",
  "botBlocks",
  "authFailures",
] as const;

let lastFlushAt = 0;

const minuteEpoch = (date = new Date()): number =>
  Math.floor(date.getTime() / MINUTE_MS);

const minuteKey = (epoch: number, route: string): string =>
  `metrics:${epoch}:${route}`;

const pendingMinutesKey = "metrics:pending_minutes";
const minuteRoutesKey = (epoch: number): string =>
  `metrics:minute_routes:${epoch}`;

export const requestRouteLabel = (req: Request): string => {
  const routePath = Array.isArray(req.route?.path)
    ? req.route.path[0]
    : req.route?.path;

  const label =
    routePath !== undefined
      ? `${req.baseUrl}${routePath}`
      : req.baseUrl || "<unmatched>";

  return label.replace(/[^a-zA-Z0-9/:_-]/g, "_").slice(0, 160);
};

const bucketStart = (
  date: Date,
  unit: "minute" | "hour" | "day" | "month"
): Date => {
  const value = new Date(date);

  if (unit === "minute") {
    value.setUTCSeconds(0, 0);
  } else if (unit === "hour") {
    value.setUTCMinutes(0, 0, 0);
  } else if (unit === "day") {
    value.setUTCHours(0, 0, 0, 0);
  } else {
    value.setUTCDate(1);
    value.setUTCHours(0, 0, 0, 0);
  }

  return value;
};

const rollupInc = (
  values: Record<string, string>
): Record<string, number> => {
  const inc: Record<string, number> = {};

  for (const field of ROLLUP_FIELDS) {
    const value = Number(values[field] ?? 0);

    if (Number.isFinite(value) && value !== 0) {
      inc[field] = value;
    }
  }

  return inc;
};

const rollupUpdate = (
  values: Record<string, string>,
  inc: Record<string, number>
): Record<string, unknown> => {
  const update: Record<string, unknown> = { $inc: inc };
  const min = Number(values.minMs ?? 0);
  const max = Number(values.maxMs ?? 0);

  if (Number.isFinite(min) && values.minMs !== undefined) {
    update.$min = { minMs: min };
  }

  if (Number.isFinite(max) && values.maxMs !== undefined) {
    update.$max = { maxMs: max };
  }

  return update;
};

const flushOneMinute = async (epoch: number): Promise<void> => {
  const store = getCacheStore();
  const routes = await store.sMembers(minuteRoutesKey(epoch));

  for (const route of routes) {
    const values = await store.hGetAll(minuteKey(epoch, route));
    const inc = rollupInc(values);

    if (Object.keys(inc).length > 0) {
      const windowStart = new Date(epoch * MINUTE_MS);
      const base = { windowStart, route };

      await MetricsMinute.findOneAndUpdate(
        base,
        {
          ...rollupUpdate(values, inc),
          $setOnInsert: {
            expireAt: new Date(windowStart.getTime() + MINUTE_TTL_MS),
          },
        },
        { upsert: true }
      );

      const hourStart = bucketStart(windowStart, "hour");

      await MetricsHour.findOneAndUpdate(
        { windowStart: hourStart, route },
        {
          ...rollupUpdate(values, inc),
          $setOnInsert: {
            expireAt: new Date(hourStart.getTime() + HOUR_TTL_MS),
          },
        },
        { upsert: true }
      );

      await MetricsDaily.findOneAndUpdate(
        { windowStart: bucketStart(windowStart, "day"), route },
        rollupUpdate(values, inc),
        { upsert: true }
      );

      await MetricsMonthly.findOneAndUpdate(
        { windowStart: bucketStart(windowStart, "month"), route },
        rollupUpdate(values, inc),
        { upsert: true }
      );
    }

    await store.del(minuteKey(epoch, route));
    await store.sRem(minuteRoutesKey(epoch), route);
  }

  await store.del(minuteRoutesKey(epoch));
  await store.sRem(pendingMinutesKey, String(epoch));
};

export const flushOldMetrics = async (
  options: { force?: boolean } = {}
): Promise<void> => {
  const now = Date.now();

  if (!options.force && now - lastFlushAt < FLUSH_THROTTLE_MS) {
    return;
  }

  lastFlushAt = now;

  try {
    const store = getCacheStore();
    const current = minuteEpoch();
    const minutes = await store.sMembers(pendingMinutesKey);

    for (const raw of minutes) {
      const epoch = Number(raw);

      if (!Number.isInteger(epoch) || epoch >= current) {
        continue;
      }

      await flushOneMinute(epoch);
    }
  } catch (error) {
    logWarn("metrics_flush_failed", {
      errorCode: "metrics_flush_failed",
      message: (error as Error)?.message ?? String(error),
    });
  }
};

export const flushMetricsForTests = async (epoch: number): Promise<void> => {
  await flushOneMinute(epoch);
};

const recordErrorLog = async (
  req: Request,
  res: Response,
  route: string
): Promise<void> => {
  if (res.statusCode < 500) {
    return;
  }

  try {
    await ErrorLog.create({
      at: new Date(),
      route,
      status: res.statusCode,
      errorCode:
        typeof res.locals.errorCode === "string"
          ? res.locals.errorCode
          : null,
      requestId: getRequestContext()?.requestId ?? null,
      message: "Internal server error",
      expireAt: new Date(Date.now() + ERROR_TTL_MS),
    });
  } catch (error) {
    logWarn("error_log_write_failed", {
      errorCode: "error_log_write_failed",
      message: (error as Error)?.message ?? String(error),
    });
  }
};

/**
 * Record one request in the current minute bucket. The bucket is flushed into
 * Mongo by later requests; there is intentionally no per-request Mongo write
 * for successful requests.
 */
export const recordRequestMetrics = async (
  req: Request,
  res: Response,
  durationMs: number
): Promise<void> => {
  const route = requestRouteLabel(req);
  const epoch = minuteEpoch();
  const metrics = (res.locals.metrics as RequestMetricFields | undefined) ??
    emptyRequestMetrics();

  try {
    const store = getCacheStore();
    const key = minuteKey(epoch, route);

    await store.hIncrBy(key, "requests", 1);
    await store.hIncrBy(key, "latencySum", Math.round(durationMs));
    await store.hIncrBy(key, "latencyCount", 1);

    if (res.statusCode >= 200 && res.statusCode < 400) {
      await store.hIncrBy(key, "success", 1);
    } else {
      await store.hIncrBy(key, "failed", 1);
    }

    if (res.statusCode >= 500) {
      await store.hIncrBy(key, "status5xx", 1);
      await store.hIncrBy(key, "errorCount", 1);
    } else if (res.statusCode === 429) {
      await store.hIncrBy(key, "status429", 1);
    } else if (res.statusCode >= 400) {
      await store.hIncrBy(key, "status4xx", 1);
    }

    for (const [field, amount] of Object.entries(metrics)) {
      if (amount > 0) {
        await store.hIncrBy(key, field, amount);
      }
    }

    const existing = await store.hGetAll(key);
    const rounded = Math.round(durationMs);
    const currentMin = Number(existing.minMs ?? 0);
    const currentMax = Number(existing.maxMs ?? 0);

    if (existing.minMs === undefined || rounded < currentMin) {
      await store.hSet(key, "minMs", String(rounded));
    }

    if (existing.maxMs === undefined || rounded > currentMax) {
      await store.hSet(key, "maxMs", String(rounded));
    }

    await store.expire(key, METRIC_TTL_SECONDS);
    await store.sAdd(pendingMinutesKey, String(epoch));
    await store.expire(pendingMinutesKey, METRIC_TTL_SECONDS);
    await store.sAdd(minuteRoutesKey(epoch), route);
    await store.expire(minuteRoutesKey(epoch), METRIC_TTL_SECONDS);
  } catch (error) {
    logWarn("metrics_record_failed", {
      errorCode: "metrics_record_failed",
      message: (error as Error)?.message ?? String(error),
    });
  }

  await recordErrorLog(req, res, route);
  await flushOldMetrics();
};

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: () => void
): void => {
  res.locals.metrics = emptyRequestMetrics();
  const startedAt = performance.now();

  res.on("finish", () => {
    void recordRequestMetrics(
      req,
      res,
      performance.now() - startedAt
    );
  });

  next();
};

export interface LatencySummary {
  avgMs: number;
  minMs: number;
  maxMs: number;
}

export interface DashboardMetrics {
  stats: Awaited<ReturnType<typeof getStatsSnapshot>>;
  hourly: Array<Record<string, any>>;
  daily: Array<Record<string, any>>;
  latestMinute: Record<string, any> | null;
  telemetry: Array<Record<string, any>>;
  errors: Array<Record<string, any>>;
  cache: {
    cacheHit: number;
    cacheMiss: number;
    redisHit: number;
    redisMiss: number;
  };
  latency: {
    create: LatencySummary;
    redirect: LatencySummary;
  };
}

const CREATE_ROUTES = new Set([
  "/api/v1/urls",
  "/api/v1/api/urls",
]);
const REDIRECT_ROUTES = new Set(["/:code"]);

const summarizeLatency = (
  entries: Array<Record<string, any>>
): LatencySummary => {
  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = 0;

  for (const entry of entries) {
    sum += entry.latencySum ?? 0;
    count += entry.latencyCount ?? 0;

    if ((entry.latencyCount ?? 0) > 0) {
      min = Math.min(min, entry.minMs ?? 0);
      max = Math.max(max, entry.maxMs ?? 0);
    }
  }

  return {
    avgMs: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
    minMs: count > 0 ? min : 0,
    maxMs: count > 0 ? max : 0,
  };
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats = await getStatsSnapshot({ force: true });
  const hourly = await MetricsHour.find({
    windowStart: { $gte: since },
  })
    .sort({ windowStart: -1 })
    .limit(500)
    .lean();
  const daily = await MetricsDaily.find({})
    .sort({ windowStart: -1 })
    .limit(30)
    .lean();
  const latestMinute = await MetricsMinute.findOne({})
    .sort({ windowStart: -1 })
    .lean();
  const telemetry = await MetricsMinute.find({
    route: "__telemetry__",
    windowStart: { $gte: since },
  })
    .sort({ windowStart: 1 })
    .limit(500)
    .lean();
  const errors = await ErrorLog.find({})
    .sort({ at: -1 })
    .limit(50)
    .lean();

  const cache = hourly.reduce(
    (acc, entry) => ({
      cacheHit: acc.cacheHit + (entry.cacheHit ?? 0),
      cacheMiss: acc.cacheMiss + (entry.cacheMiss ?? 0),
      redisHit: acc.redisHit + (entry.redisHit ?? 0),
      redisMiss: acc.redisMiss + (entry.redisMiss ?? 0),
    }),
    { cacheHit: 0, cacheMiss: 0, redisHit: 0, redisMiss: 0 }
  );

  return {
    stats,
    hourly,
    daily,
    latestMinute,
    telemetry,
    errors,
    cache,
    latency: {
      create: summarizeLatency(
        hourly.filter((entry) => CREATE_ROUTES.has(entry.route))
      ),
      redirect: summarizeLatency(
        hourly.filter((entry) => REDIRECT_ROUTES.has(entry.route))
      ),
    },
  };
};

export const listErrors = async (limit = 100) =>
  ErrorLog.find({})
    .sort({ at: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .lean();
