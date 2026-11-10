import { Link } from "../models/link.models.js";
import { logError } from "./logger.js";

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
