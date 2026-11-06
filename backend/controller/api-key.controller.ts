import type { Request, Response } from "express";
import {
  createShortUrlFromPrepared,
  prepareUrl,
  ShortCodeExhaustedError,
} from "../service/url.service.js";
import {
  applyStageTimingHeaders,
  createStageTimings,
} from "../service/stage-timing.service.js";
import {
  decrementApiKeyUsage,
  getApiKeyUsageById,
  incrementApiKeyUsage,
} from "../service/api-key.service.js";
import { scheduleTotalLinksIncrement } from "../service/stats.service.js";
import { logError } from "../service/logger.js";
import { PublicError, getPublicErrorMessage } from "../service/public-error.service.js";
import { env } from "../src/config/env.js";

/**
 * External authenticated shorten endpoint (`/api/v1/api/urls`).
 *
 * Requires a valid API key (enforced by `apiKeyAuthMiddleware`). Used by
 * scripts, iPhone Shortcuts and other non-browser clients.
 */
export const externalShortenController = async (
  req: Request,
  res: Response
) => {
  const timings = createStageTimings();

  try {
    const { url } = req.body ?? {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    const apiKeyId = req.apiKey?.id;

    if (!apiKeyId) {
      return res.status(401).json({
        success: false,
        message: "Missing API secret.",
      });
    }

    // Validate and clean before reserving quota so bad input never counts
    // against the key's monthly allowance.
    const prepared = prepareUrl(url, timings);

    const incremented = await incrementApiKeyUsage(apiKeyId);

    if (!incremented) {
      return res.status(429).json({
        success: false,
        message: `Monthly quota of ${env.API_KEY_MONTHLY_LIMIT.toLocaleString()} links exceeded. Try again next month.`,
      });
    }

    let result;

    try {
      result = await createShortUrlFromPrepared(prepared, timings);

      if (timings) {
        timings.created = result.created;
      }
    } catch (error) {
      // The slot was reserved but no link was created; give it back.
      try {
        await decrementApiKeyUsage(apiKeyId);
      } catch (rollbackError) {
        logError("API KEY USAGE ROLLBACK ERROR", rollbackError, {
          operation: "externalShortenController",
        });
      }

      throw error;
    }

    applyStageTimingHeaders(res, timings);

    const response = res.status(201).json({
      success: true,
      shortUrl: result.shortUrl,
    });

    if (result.created) {
      scheduleTotalLinksIncrement();
    }

    return response;
  } catch (error) {
    if (error instanceof ShortCodeExhaustedError) {
      return res.status(error.statusCode).json({
        success: false,
        message: "Unable to generate a short code right now. Please try again.",
      });
    }

    const isPublic = error instanceof PublicError;

    if (!isPublic) {
      logError("request_error", error, {
        errorCode: "request_error",
        operation: "externalShortenController",
      });
    }

    return res.status(isPublic ? 400 : 500).json({
      success: false,
      message: getPublicErrorMessage(
        error,
        "Unable to shorten URL"
      ),
    });
  }
};

/**
 * Read current usage stats for the supplied API secret
 * (`/api/v1/api/stats/usage`).
 */
export const readApiKeyUsage = async (
  req: Request,
  res: Response
) => {
  try {
    const apiKeyId = req.apiKey?.id;

    if (!apiKeyId) {
      return res.status(401).json({
        success: false,
        message:
          "Missing API secret. Provide it in the Authorization header.",
      });
    }

    const usage = await getApiKeyUsageById(apiKeyId);

    return res.status(200).json({
      success: true,
      data: usage,
    });
  } catch (error) {
    const statusCode =
      error instanceof Error &&
      "statusCode" in error &&
      typeof (error as any).statusCode === "number"
        ? (error as any).statusCode
        : 500;

    const isPublic = error instanceof PublicError;

    if (!isPublic) {
      logError("request_error", error, {
        errorCode: "request_error",
        operation: "readApiKeyUsage",
      });
    }

    return res.status(statusCode).json({
      success: false,
      message: getPublicErrorMessage(
        error,
        "Unable to read usage stats"
      ),
    });
  }
};