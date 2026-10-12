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

/**
 * Find a link by hash regardless of expiry status.
 *
 * Used when an insert loses the race on the unique `urlHash` index: the row
 * that won may have just expired between our read and our insert, so the
 * expiry filter must not apply — we still adopt it and refresh its expiry.
 */
export const findLinkByUrlHash = async (
  urlHash: string
) => {
  try {
    return await Link.findOne({ urlHash }).lean();
  } catch (error) {
    logError(
      "DATABASE QUERY ERROR",
      error,
      {
        operation: "findLinkByUrlHash",
        model: "Link",
        urlHash,
      }
    );

    throw error;
  }
};
