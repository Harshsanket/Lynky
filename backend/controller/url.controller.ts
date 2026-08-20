import type { Request, Response } from "express";
import mongoose from "mongoose";
import { createShortUrl } from "../service/url.service.js";
import { incrementTotalLinks } from "../service/stats.service.js";
import {
  ApiKeyError,
  findAndRolloverApiKey,
  incrementApiKeyUsage,
} from "../service/api-key.service.js";
import { logError } from "../service/logger.js";
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

    const result = await createShortUrl(url);

    try {
      await incrementTotalLinks();
    } catch (error) {
      logError("STATS INCREMENT ERROR", error, {
        operation: "incrementTotalLinks",
        source: "createShortUrlController",
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        shortUrl: result.shortUrl,
      },
    });
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    const isPublic = error instanceof PublicError;

    if (!isPublic) {
      logError("CREATE SHORT URL ERROR", error, {
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