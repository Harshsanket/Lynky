import { Link } from "../models/link.models.js";
import { logError } from "./logger.js";

/**
 * Find an existing, un-expired link for a cleaned-URL hash.
 *
 * Used to return the same short code (with a refreshed expiry) when the same
 * destination is shortened again, instead of creating a duplicate record.
 */
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
