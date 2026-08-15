import { Link } from "../models/link.models.js";
import { logError } from "./logger.js";

export const findExistingUrl = async (
  urlHash: string
) => {
  try {
    return await Link.findOne({
      urlHash,
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
        urlHash,
      }
    );

    throw error;
  }
};
