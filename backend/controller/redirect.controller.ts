import type { Request, Response } from "express";
import { env } from "../src/config/env.js";
import { decryptUrl } from "../service/encryption.service.js";
import { logError, logWarn } from "../service/logger.js";
import { assertNotOwnLink } from "../service/own-link.service.js";
import { PublicError } from "../service/public-error.service.js";
import { validateUrl } from "../service/url-validator.service.js";
import {
  getCachedLink,
  invalidateLinkCache,
  markHotLink,
  recordVisitWindow,
  setCachedLink,
  slideCachedLink,
  type CachedLink,
} from "../service/link-cache.service.js";
import {
  isNegativelyCached,
  markNegative,
} from "../service/negative-cache.service.js";
import {
  recordClick,
  flushPendingClicks,
} from "../service/click-accounting.service.js";
import { findLinkForRedirect } from "../service/link-lookup.service.js";
import {
  sendShortLinkGone,
  sendShortLinkNotFound,
  sendSuccessfulRedirect,
} from "../service/redirect-response.service.js";
import { markRequestMetric } from "../service/metrics.service.js";
import { runInBackground } from "../src/utils/background.js";

const validateStoredDestination = (originalUrl: string): void => {
  // Blocklists are deliberately skipped at redirect time: a list update must
  // not break links that were valid when created.
  assertNotOwnLink(
    validateUrl(originalUrl, {
      enforceMaxLength: false,
      checkBlocklists: false,
    })
  );
};

const sendServerError = (res: Response, message: string): Response => {
  res.setHeader("Cache-Control", "no-store");

  return res.status(500).json({
    success: false,
    message,
  });
};

const scheduleFailureCount = (code: string): void => {
  runInBackground(() => recordClick(code, false), {
    event: "redirect_background_failed",
    errorCode: "redirect_background_failed",
    maxAttempts: 1,
    context: { operation: "redirectToOriginalUrl", counted: "failure" },
  });
};

const scheduleHotSuccess = (
  code: string,
  cached: CachedLink
): void => {
  runInBackground(
    async () => {
      await Promise.all([
        recordClick(code, true),
        slideCachedLink(code, cached.expiresAt),
      ]);
      await flushPendingClicks(code);
    },
    {
      event: "redirect_background_failed",
      errorCode: "redirect_background_failed",
      maxAttempts: 1,
      context: { operation: "redirectToOriginalUrl", cached: true },
    }
  );
};

const scheduleColdSuccess = (
  code: string,
  expiresAt: Date,
  originalUrl: string
): void => {
  runInBackground(
    async () => {
      const [visits] = await Promise.all([
        recordVisitWindow(code),
        recordClick(code, true, { writeLinkNow: true }),
      ]);

      await flushPendingClicks(code);

      if (visits >= env.HOT_VISIT_THRESHOLD) {
        await markHotLink(code, expiresAt);
        await setCachedLink(code, {
          originalUrl,
          expiresAt,
        });
      }
    },
    {
      event: "redirect_background_failed",
      errorCode: "redirect_background_failed",
      maxAttempts: 1,
      context: { operation: "redirectToOriginalUrl", cached: false },
    }
  );
};

/**
 * Redirect `/code` to the stored (cleaned) destination.
 *
 * The lookup is user-facing; click accounting and cache maintenance run after
 * the response through `runInBackground`. Hot links are served from Redis
 * without touching MongoDB. Cold/missing links fall back to Mongo, with a
 * 30-second local negative cache for repeated false codes.
 */
export const redirectToOriginalUrl = async (
  req: Request<{ code: string }>,
  res: Response
) => {
  const { code } = req.params;

  try {
    const cached = await getCachedLink(code);

    if (cached) {
      markRequestMetric(res, "cacheHit");
      markRequestMetric(res, "redisHit");
      markRequestMetric(res, "redisCalls");

      try {
        const originalUrl = decryptUrl(cached.originalUrl);

        validateStoredDestination(originalUrl);

        sendSuccessfulRedirect(res, originalUrl);
        scheduleHotSuccess(code, cached);
        return;
      } catch (error) {
        // A corrupt/stale cache entry must not turn into a broken redirect;
        // drop it and retry through MongoDB.
        await invalidateLinkCache(code);

        logWarn("link_cache_entry_rejected", {
          operation: "redirectToOriginalUrl",
          kind:
            error instanceof PublicError ? "policy" : "corruption",
        });
      }
    } else {
      markRequestMetric(res, "cacheMiss");
      markRequestMetric(res, "redisMiss");
      markRequestMetric(res, "redisCalls");
    }

    if (isNegativelyCached(code)) {
      sendShortLinkNotFound(req, res);
      scheduleFailureCount(code);
      return;
    }

    let link;

    try {
      link = await findLinkForRedirect(code);
      markRequestMetric(res, "mongoCalls");
    } catch (error) {
      logError("request_error", error, {
        errorCode: "database_unavailable",
        operation: "redirectToOriginalUrl",
      });

      res.status(503).json({
        success: false,
        message: "Database is unavailable, please try again later",
      });
      scheduleFailureCount(code);
      return;
    }

    if (!link) {
      markNegative(code);
      sendShortLinkNotFound(req, res);
      scheduleFailureCount(code);
      return;
    }

    let originalUrl: string;

    try {
      originalUrl = decryptUrl(link.originalUrl);
    } catch (error) {
      logError("request_error", error, {
        errorCode: "redirect_decrypt_error",
        operation: "redirectToOriginalUrl",
        kind: "corruption",
      });

      sendServerError(res, "Unable to resolve destination");
      scheduleFailureCount(code);
      return;
    }

    try {
      validateStoredDestination(originalUrl);
    } catch (error) {
      const policyFailure = error instanceof PublicError;

      markNegative(code);

      if (policyFailure) {
        logWarn("redirect_destination_rejected", {
          operation: "redirectToOriginalUrl",
          kind: "policy",
        });
      } else {
        logError("request_error", error, {
          errorCode: "redirect_corruption",
          operation: "redirectToOriginalUrl",
          kind: "corruption",
        });
      }

      if (policyFailure) {
        sendShortLinkGone(req, res);
      } else {
        sendServerError(res, "Unable to resolve destination");
      }

      scheduleFailureCount(code);
      return;
    }

    sendSuccessfulRedirect(res, originalUrl);
    scheduleColdSuccess(code, link.expiresAt, originalUrl);
  } catch (error) {
    logError("request_error", error, {
      errorCode: "request_error",
      operation: "redirectToOriginalUrl",
    });

    sendServerError(res, "Unable to redirect");
    scheduleFailureCount(code);
  }
};
