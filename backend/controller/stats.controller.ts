import type { Request, Response } from "express";
import { getTotalLinks } from "../service/stats.service.js";
import { logError } from "../service/logger.js";

/**
 * Read the global "links cleaned & shortened" counter
 * (`GET /api/v1/stats/links`).
 *
 * Note: the counter is only ever incremented server-side as a side-effect of
 * link creation. There is intentionally no public increment endpoint — an
 * unauthenticated one would let anyone inflate the number.
 */
export const readTotalLinks = async (
  req: Request,
  res: Response
) => {
  try {
    const totalLinks = await getTotalLinks();

    return res.status(200).json({
      totalLinks,
    });
  } catch (error) {
    logError("READ TOTAL LINKS ERROR", error, {
      operation: "readTotalLinks",
    });

    return res.status(500).json({
      message: "Unable to read stats",
    });
  }
};