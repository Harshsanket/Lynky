import type { Request, Response } from "express";
import { getStatsSnapshot } from "../service/stats.service.js";
import { logError } from "../service/logger.js";
import {
  setStatsCacheHeaders,
  setStatusCacheHeaders,
} from "../src/utils/http-cache.js";

export const statusController = async (
  _req: Request,
  res: Response
) => {
  try {
    const stats = await getStatsSnapshot();

    setStatusCacheHeaders(res);

    return res.status(200).json({
      online: true,
      totalLinks: stats.totalLinks,
      ...(stats.stale ? { stale: true } : {}),
    });
  } catch (error) {
    logError("status_read_error", error, {
      errorCode: "status_unavailable",
      operation: "statusController",
    });

    return res.status(503).json({
      online: false,
      totalLinks: null,
    });
  }
};

export const publicStatsController = async (
  _req: Request,
  res: Response
) => {
  try {
    const stats = await getStatsSnapshot();

    setStatsCacheHeaders(res);

    return res.status(200).json({
      success: true,
      data: {
        totalLinks: stats.totalLinks,
        totalRedirects: stats.totalRedirects,
        totalClicksAttempts: stats.totalClicksAttempts,
        totalClicksSuccess: stats.totalClicksSuccess,
        totalClicksFailed: stats.totalClicksFailed,
        pendingRedirects: stats.pendingRedirects,
      },
      ...(stats.stale ? { stale: true } : {}),
    });
  } catch (error) {
    logError("stats_read_error", error, {
      errorCode: "stats_unavailable",
      operation: "publicStatsController",
    });

    return res.status(503).json({
      success: false,
      message: "Stats are unavailable.",
    });
  }
};
