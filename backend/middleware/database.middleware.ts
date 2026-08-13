import type { Request, Response, NextFunction } from "express";
import { connectDatabase } from "../database/index.database.js";

export const databaseConnectionMiddleware = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await connectDatabase();

    next();
  } catch (error) {
    console.error(
      "Database connection middleware error:",
      error
    );

    return res.status(503).json({
      success: false,
      message:
        "Database is unavailable, please try again later",
    });
  }
};