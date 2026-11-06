import { monitorEventLoopDelay } from "node:perf_hooks";
import { env } from "../src/config/env.js";
import { MetricsMinute } from "../models/metrics.models.js";
import { logWarn } from "./logger.js";

/**
 * Development-only process telemetry for the §21 load runs.
 *
 * `monitorEventLoopDelay` is enabled only when `SERVER_STAGE_TIMINGS=1`, so a
 * normal production process never pays for the histogram or the sampler.
 */
const histogram = env.SERVER_STAGE_TIMINGS
  ? monitorEventLoopDelay({ resolution: 5 })
  : null;

if (histogram) {
  histogram.enable();
}

export interface RuntimeTelemetry {
  rssMb: number;
  heapUsedMb: number;
  eventLoopLagP50Ms: number;
  eventLoopLagP99Ms: number;
  eventLoopLagMaxMs: number;
}

const round = (value: number): number =>
  Math.round(value * 1000) / 1000;

const nanosecondsToMs = (value: number): number =>
  round(value / 1_000_000);

export const readRuntimeTelemetry = (
  options: { reset?: boolean } = {}
): RuntimeTelemetry => {
  const memory = process.memoryUsage();
  const reset = options.reset ?? true;

  const lag = histogram
    ? {
        eventLoopLagP50Ms: nanosecondsToMs(histogram.percentile(50)),
        eventLoopLagP99Ms: nanosecondsToMs(histogram.percentile(99)),
        eventLoopLagMaxMs: nanosecondsToMs(histogram.max),
      }
    : {
        eventLoopLagP50Ms: 0,
        eventLoopLagP99Ms: 0,
        eventLoopLagMaxMs: 0,
      };

  if (histogram && reset) {
    histogram.reset();
  }

  return {
    rssMb: round(memory.rss / 1024 / 1024),
    heapUsedMb: round(memory.heapUsed / 1024 / 1024),
    ...lag,
  };
};

const MINUTE_MS = 60_000;
const TELEMETRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Persist one sample into the existing minute rollup collection. */
export const recordTelemetrySample = async (): Promise<void> => {
  if (!env.SERVER_STAGE_TIMINGS) {
    return;
  }

  const sample = readRuntimeTelemetry({ reset: true });
  const windowStart = new Date(
    Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
  );

  try {
    await MetricsMinute.findOneAndUpdate(
      { windowStart, route: "__telemetry__" },
      {
        $set: {
          eventLoopLagP99Ms: sample.eventLoopLagP99Ms,
          eventLoopLagMaxMs: sample.eventLoopLagMaxMs,
          rssMb: sample.rssMb,
          heapUsedMb: sample.heapUsedMb,
        },
        $setOnInsert: {
          expireAt: new Date(Date.now() + TELEMETRY_TTL_MS),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    logWarn("telemetry_write_failed", {
      errorCode: "telemetry_write_failed",
      message: (error as Error)?.message ?? String(error),
    });
  }
};

export const startTelemetrySampler = (): void => {
  if (!env.SERVER_STAGE_TIMINGS) {
    return;
  }

  const timer = setInterval(() => {
    void recordTelemetrySample();
  }, 10_000);

  timer.unref();
};
