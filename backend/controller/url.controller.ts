import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  createShortUrlFromPrepared,
  prepareUrl,
  ShortCodeExhaustedError,
} from "../service/url.service.js";
import {
  applyStageTimingHeaders,
  createStageTimings,
} from "../service/stage-timing.service.js";
import { scheduleTotalLinksIncrement } from "../service/stats.service.js";
import {
  ApiKeyError,
  decrementApiKeyUsage,
  findAndRolloverApiKey,
  incrementApiKeyUsage,
} from "../service/api-key.service.js";
import { logError } from "../service/logger.js";
import {
  markRequestMetric,
  setMetricErrorCode,
} from "../service/metrics.service.js";
import { PublicError, getPublicErrorMessage } from "../service/public-error.service.js";
import { extractBearerSecret } from "../src/utils/http.js";
import { env } from "../src/config/env.js";

/**
 * Create a shortened URL.
 *
 * Public endpoint (frontend home page). Optionally authenticates with a
 * bearer API secret to count the request against the key's monthly quota.
 */
export const createShortUrlController = async (
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

    const secret = extractBearerSecret(req);

    let apiKeyId: mongoose.Types.ObjectId | null = null;

    if (secret) {
      const key = await findAndRolloverApiKey(secret);

      apiKeyId = key._id;
    }

    // Validate and clean before reserving quota so bad input never counts
    // against the key's monthly allowance.
    const prepared = prepareUrl(url, timings);

    // Reserve the quota slot *before* creating the link so an over-quota key
    // can never sneak a record into the database.
    if (apiKeyId) {
      const incremented = await incrementApiKeyUsage(apiKeyId);

      if (!incremented) {
        return res.status(429).json({
          success: false,
          message: `Monthly quota of ${env.API_KEY_MONTHLY_LIMIT.toLocaleString()} links exceeded. Try again next month.`,
        });
      }
    }

    let result;

    try {
      result = await createShortUrlFromPrepared(prepared, timings);

      if (timings) {
        timings.created = result.created;
      }
    } catch (error) {
      // The slot was reserved but no link was created; give it back.
      if (apiKeyId) {
        try {
          await decrementApiKeyUsage(apiKeyId);
        } catch (rollbackError) {
          logError("API KEY USAGE ROLLBACK ERROR", rollbackError, {
            operation: "createShortUrlController",
          });
        }
      }

      throw error;
    }

    applyStageTimingHeaders(res, timings);

    const response = res.status(201).json({
      success: true,
      data: {
        shortUrl: result.shortUrl,
      },
    });

    if (result.created) {
      // Best-effort side effect: coalesced and delivered after the response.
      scheduleTotalLinksIncrement();
    }

    return response;
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (error instanceof ShortCodeExhaustedError) {
      markRequestMetric(res, "shortCodeExhausted");
      setMetricErrorCode(res, "short_code_exhausted");

      return res.status(error.statusCode).json({
        success: false,
        message: "Unable to generate a short code right now. Please try again.",
      });
    }

    const isPublic = error instanceof PublicError;

    if (!isPublic) {
      logError("request_error", error, {
        errorCode: "request_error",
        operation: "createShortUrlController",
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