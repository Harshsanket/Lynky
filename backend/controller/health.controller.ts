import type { Request, Response } from "express";
import mongoose from "mongoose";
import { getEngineRuntime } from "../service/engines/runtime.js";
import { getCacheStatus } from "../service/redis.client.js";
import { getRequestContext } from "../service/request-context.service.js";
import { readRuntimeTelemetry } from "../service/telemetry.service.js";
import { env } from "../src/config/env.js";

/** Liveness: the process is up. Never touches MongoDB or config artifacts. */
export const healthController = (_req: Request, res: Response) => {
  return res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    ...(env.SERVER_STAGE_TIMINGS
      ? { telemetry: readRuntimeTelemetry({ reset: false }) }
      : {}),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness: compiled config, blocklist state, and database availability.
 * Returns 503 with a degraded body instead of hiding the reason.
 */
export const readyController = (_req: Request, res: Response) => {
  const runtime = getEngineRuntime();
  const blocklistState = runtime.blocklist.getState();
  const databaseReady = mongoose.connection.readyState === 1;

  const config = {
    status: "ok",
    artifactVersion: runtime.artifacts.manifest.artifactVersion,
    validatorVersion: runtime.artifacts.manifest.validatorVersion,
  };

  const blocklist = {
    status: blocklistState.status,
    decision: blocklistState.decision,
    ...(blocklistState.reason
      ? { reason: blocklistState.reason }
      : {}),
  };

  const ready =
    config.status === "ok" &&
    blocklist.status === "ok" &&
    databaseReady;

  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    config,
    blocklist,
    db: {
      status: databaseReady ? "ok" : "unavailable",
    },
    cache: getCacheStatus(),
    version: runtime.artifacts.manifest.artifactVersion,
    requestId: getRequestContext()?.requestId ?? null,
    timestamp: new Date().toISOString(),
  });
};
