import type { Request, Response } from "express";
import mongoose from "mongoose";
import { connectDatabase } from "../database/index.database.js";
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
 *
 * A passive `readyState` check would report 503 on healthy instances that
 * have not served a DB route yet (or whose idle Atlas socket was dropped).
 * When not connected, the probe makes one shared connect attempt with a hard
 * 3-second cap, then re-reads the state and reports honestly.
 */
const DB_PROBE_TIMEOUT_MS = 3000;

type ReadyRuntime = {
  artifacts: {
    manifest: {
      artifactVersion: string;
      validatorVersion: string;
    };
  };
  blocklist: {
    getState: () => {
      status: string;
      decision: string;
      reason?: string;
    };
  };
};

type ReadyDeps = {
  connectDatabase?: () => Promise<unknown>;
  getRuntime?: () => ReadyRuntime;
  getCacheStatus?: typeof getCacheStatus;
};

let dbProbe: Promise<void> | null = null;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("database probe timed out")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

const probeDatabase = (
  connect: () => Promise<unknown>
): Promise<void> => {
  if (dbProbe) {
    return dbProbe;
  }

  dbProbe = withTimeout(
    Promise.resolve().then(connect),
    DB_PROBE_TIMEOUT_MS
  )
    .then(() => undefined)
    .finally(() => {
      dbProbe = null;
    });

  return dbProbe;
};

export const createReadyController = (
  deps: ReadyDeps = {}
) => {
  const connect = deps.connectDatabase ?? connectDatabase;
  const getRuntime = deps.getRuntime ?? getEngineRuntime;
  const getCache = deps.getCacheStatus ?? getCacheStatus;

  return async (_req: Request, res: Response) => {
    if (mongoose.connection.readyState !== 1) {
      try {
        await probeDatabase(connect);
      } catch {
        // The re-read below produces the honest 503; a failed probe is
        // reported through the existing db status field, not a new shape.
      }
    }

    const runtime = getRuntime();
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
      cache: getCache(),
      version: runtime.artifacts.manifest.artifactVersion,
      requestId: getRequestContext()?.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  };
};

export const readyController = createReadyController();
