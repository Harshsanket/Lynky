import type { Response } from "express";
import { env } from "../src/config/env.js";

/**
 * Development-only create-path timings.
 *
 * The load harness enables `SERVER_STAGE_TIMINGS=1` and reads the response
 * headers. Nothing is allocated or measured when the flag is off, so the
 * production path has no extra timers.
 */
export interface StageTimings {
  algorithmsMs: number;
  dedupeMs: number;
  codegenMs: number;
  insertMs: number;
  codegenAttempts: number;
  created?: boolean;
}

type TimingKey =
  | "algorithmsMs"
  | "dedupeMs"
  | "codegenMs"
  | "insertMs";

export const createStageTimings = (): StageTimings | null =>
  env.SERVER_STAGE_TIMINGS
    ? {
        algorithmsMs: 0,
        dedupeMs: 0,
        codegenMs: 0,
        insertMs: 0,
        codegenAttempts: 0,
      }
    : null;

export const addStageTime = (
  timings: StageTimings | null | undefined,
  key: TimingKey,
  startedAt: number
): void => {
  if (timings) {
    timings[key] += performance.now() - startedAt;
  }
};

export const measureStageSync = <T>(
  timings: StageTimings | null | undefined,
  key: TimingKey,
  operation: () => T
): T => {
  if (!timings) {
    return operation();
  }

  const startedAt = performance.now();

  try {
    return operation();
  } finally {
    addStageTime(timings, key, startedAt);
  }
};

export const measureStage = async <T>(
  timings: StageTimings | null | undefined,
  key: TimingKey,
  operation: () => Promise<T>
): Promise<T> => {
  if (!timings) {
    return operation();
  }

  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    addStageTime(timings, key, startedAt);
  }
};

const headerValue = (value: number): string =>
  value.toFixed(3);

/** Expose the measured stages on the response, only in dev-benchmark mode. */
export const applyStageTimingHeaders = (
  res: Response,
  timings: StageTimings | null | undefined
): void => {
  if (!timings || !env.SERVER_STAGE_TIMINGS) {
    return;
  }

  res.setHeader(
    "X-Lynky-Stage-Algorithms-Ms",
    headerValue(timings.algorithmsMs)
  );
  res.setHeader(
    "X-Lynky-Stage-Dedupe-Ms",
    headerValue(timings.dedupeMs)
  );
  res.setHeader(
    "X-Lynky-Stage-Codegen-Ms",
    headerValue(timings.codegenMs)
  );
  res.setHeader(
    "X-Lynky-Stage-Insert-Ms",
    headerValue(timings.insertMs)
  );
  res.setHeader(
    "X-Lynky-Stage-Codegen-Attempts",
    String(timings.codegenAttempts)
  );
  res.setHeader(
    "X-Lynky-Created",
    timings.created === true ? "true" : "false"
  );
};
