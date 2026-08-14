import { Link } from "../models/link.models.js";
import { logError } from "./logger.js";

export const findExistingUrl = async (
  cleanedUrl: string
) => {
  try {
    return await Link.findOne({
      originalUrl: cleanedUrl,
      expiresAt: {
        $gt: new Date(),
      },
    }).lean();
  } catch (error) {
    logError(
      "DATABASE QUERY ERROR",
      error,
      {
        operation: "findExistingShortUrl",
        model: "Link",
        cleanedUrl,
      }
    );

    throw error;
  }
};