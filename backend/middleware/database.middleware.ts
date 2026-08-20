import type { Request, Response, NextFunction } from "express";
import { connectDatabase } from "../database/index.database.js";
import { logError } from "../service/logger.js";

/**
 * Ensures a MongoDB connection exists before the route handler runs.
 * Returns 503 when the database is unreachable.
 */
export const databaseConnectionMiddleware = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await connectDatabase();

    next();
  } catch (error) {
    logError("DATABASE CONNECTION MIDDLEWARE ERROR", error, {
      operation: "databaseConnectionMiddleware",
    });

    return res.status(503).json({
      success: false,
      message:
        "Database is unavailable, please try again later",
    });
  }
};