import type { Request, Response } from "express";
import { createShortUrl } from "../service/url.service.js";
import { incrementApiKeyUsage, getApiKeyUsage } from "../service/api-key.service.js";
import { incrementTotalLinks } from "../service/stats.service.js";
import { logError } from "../service/logger.js";

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

    const result = await createShortUrl(url);

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
        message:
          "Monthly quota of 10,000 links exceeded. Try again next month.",
      });
    }

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
    console.error("External shorten error:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to shorten URL",
    });
  }
};

export const readApiKeyUsage = async (
  req: Request,
  res: Response
) => {
  try {
    const authHeader = req.headers.authorization;

    const secret = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

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

    return res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to read usage stats",
    });
  }
};
