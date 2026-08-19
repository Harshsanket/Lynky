import type { Request, Response } from "express";
import { createShortUrl } from "../service/url.service.js";
import { incrementTotalLinks } from "../service/stats.service.js";
import { logError } from "../service/logger.js";

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