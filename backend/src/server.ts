import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDatabase } from "../database/index.database.js";
import { env } from "./config/env.js";
import { validateUrl } from "../service/url-validator.service.js";
import { initializeEngines } from "../service/engines/runtime.js";
import { initializeCache } from "../service/redis.client.js";
import { ensureLinkIndexesReady } from "../service/link-index.service.js";
import { startTelemetrySampler } from "../service/telemetry.service.js";
import { logError, logInfo } from "../service/logger.js";

/**
 * Boot-time smoke test for the URL validator.
 *
 * If a dependency upgrade silently breaks hostname/IP classification the
 * server would otherwise "work" while accepting `http://127.0.0.1` links.
 * Refusing to start makes the regression loud instead of quiet.
 */
const runValidatorSmokeTest = (): void => {
  const okUrl = validateUrl("https://example.com/smoke");

  if (okUrl.hostname !== "example.com") {
    throw new Error(
      "Validator smoke test failed: https://example.com did not parse"
    );
  }

  const mustReject = [
    "http://127.0.0.1/",
    "http://user:pass@example.net/",
  ];

  for (const badUrl of mustReject) {
    let rejected = false;

    try {
      validateUrl(badUrl);
    } catch {
      rejected = true;
    }

    if (!rejected) {
      throw new Error(
        `Validator smoke test failed: did not reject ${badUrl}`
      );
    }
  }

  logInfo("validator_smoke_test_passed");
};

/**
 * Log the effective non-secret configuration so local/.env drift and hosting
 * mismatches are visible at startup. Secrets and connection strings are never
 * included.
 */
const logEffectiveConfig = (): void => {
  logInfo("config_effective", {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    publicUrl: env.PUBLIC_URL,
    frontendUrl: env.FRONTEND_URL ?? null,
    blocklistFailureMode: env.BLOCKLIST_FAILURE_MODE,
    fullRuntimeValidation: env.CONFIG_FULL_RUNTIME_VALIDATION,
    allowPrivateSuffixes: env.ALLOW_PRIVATE_SUFFIXES,
    minCodeLength: env.MIN_CODE_LENGTH,
    maxCodeLength: env.MAX_CODE_LENGTH,
    maxCodeAttempts: env.MAX_CODE_ATTEMPTS,
    expirationDays: env.EXPIRATION_DAYS,
    maxUrlLength: env.MAX_URL_LENGTH,
    apiKeyLength: env.API_KEY_LENGTH,
    apiKeyMonthlyLimit: env.API_KEY_MONTHLY_LIMIT,
    upstashRedisConfigured: Boolean(env.UPSTASH_REDIS_REST_URL),
    globalRateLimitPerHour: env.GLOBAL_RATE_LIMIT_PER_HOUR,
    linkRateLimitPer15Min: env.LINK_RATE_LIMIT_PER_15_MIN,
    serverStageTimings: env.SERVER_STAGE_TIMINGS,
    hotVisitThreshold: env.HOT_VISIT_THRESHOLD,
    hotWindowSeconds: env.HOT_WINDOW_SECONDS,
    hotCacheTtlSeconds: env.HOT_CACHE_TTL_SECONDS,
    clickStorageMode: env.CLICK_STORAGE_MODE,
    clickExactBelowPerHour: env.CLICK_EXACT_BELOW_PER_HOUR,
    clickFlushEveryN: env.CLICK_FLUSH_EVERY_N,
    clickFlushIntervalMs: env.CLICK_FLUSH_INTERVAL_MS,
    clickPendingTtlSeconds: env.CLICK_PENDING_TTL_SECONDS,
    sysadminEnabled: env.SYSADMIN_ENABLED,
  });
};

const startServer = async () => {
  logEffectiveConfig();

  initializeEngines();

  runValidatorSmokeTest();

  await initializeCache();
  await connectDatabase();
  await ensureLinkIndexesReady();

  startTelemetrySampler();

  const server = app.listen(env.PORT, () => {
    logInfo("server_started", { port: env.PORT });
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    logInfo("server_shutdown", { signal });

    const forceExit = setTimeout(() => {
      logError(
        "shutdown_timeout",
        new Error("Shutdown timed out; forcing exit."),
        { errorCode: "shutdown_timeout" }
      );
      process.exit(1);
    }, 10_000);

    forceExit.unref();

    server.close(async (error) => {
      clearTimeout(forceExit);

      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        logError("mongo_disconnect_failed", disconnectError, {
          errorCode: "mongo_disconnect_failed",
        });
      }

      process.exit(error ? 1 : 0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

process.on("unhandledRejection", (reason) => {
  logError("unhandled_rejection", reason, {
    errorCode: "unhandled_rejection",
  });
  process.exit(1);
});

startServer().catch((error) => {
  logError("server_start_failed", error, {
    errorCode: "server_start_failed",
  });
  process.exitCode = 1;
});
