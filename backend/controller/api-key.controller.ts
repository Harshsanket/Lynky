import type { Request, Response } from "express";
import { createShortUrl } from "../service/url.service.js";
import { incrementApiKeyUsage, getApiKeyUsage } from "../service/api-key.service.js";
import { incrementTotalLinks } from "../service/stats.service.js";
import { logError } from "../service/logger.js";
import { PublicError, getPublicErrorMessage } from "../service/public-error.service.js";
import { extractBearerSecret } from "../src/utils/http.js";
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

    const incremented = await incrementApiKeyUsage(apiKeyId);

    if (!incremented) {
      return res.status(429).json({
        success: false,
        message: `Monthly quota of ${env.API_KEY_MONTHLY_LIMIT.toLocaleString()} links exceeded. Try again next month.`,
      });
    }

    const result = await createShortUrl(url);

    try {
      await incrementTotalLinks();
    } catch (error) {
      logError("STATS INCREMENT ERROR", error, {
        operation: "incrementTotalLinks",
        source: "externalShortenController",
      });
    }

    return res.status(201).json({
      success: true,
      shortUrl: result.shortUrl,
    });
  } catch (error) {
    const isPublic = error instanceof PublicError;

    if (!isPublic) {
      logError("EXTERNAL SHORTEN ERROR", error, {
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
    const secret = extractBearerSecret(req);

    if (!secret) {
      return res.status(401).json({
        success: false,
        message:
          "Missing API secret. Provide it in the Authorization header.",
      });
    }

    const usage = await getApiKeyUsage(secret);

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
      logError("READ USAGE ERROR", error, {
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