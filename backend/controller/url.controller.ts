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

const extractBearerSecret = (
  req: Request
): string | null => {
  const header = req.headers.authorization;

  return header?.startsWith("Bearer ")
    ? header.slice(7).trim()
    : null;
};

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

    const result = await createShortUrl(url);

    if (apiKeyId) {
      const incremented = await incrementApiKeyUsage(apiKeyId);

      if (!incremented) {
        return res.status(429).json({
          success: false,
          message:
            "Monthly quota of 10,000 links exceeded. Try again next month.",
        });
      }
    }

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

    console.error("Create short URL error:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to shorten URL",
    });
  }
};