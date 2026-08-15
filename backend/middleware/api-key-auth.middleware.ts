import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  ApiKeyError,
  findAndRolloverApiKey,
  validateAndPrepareApiKey,
} from "../service/api-key.service.js";

declare global {
  namespace Express {
    interface Request {
      apiKey?: { id: mongoose.Types.ObjectId };
    }
  }
}

export const apiKeyAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const secret = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!secret) {
      return res.status(401).json({
        success: false,
        message:
          "Missing API secret. Provide it in the Authorization header.",
      });
    }

    const key = await validateAndPrepareApiKey(secret);

    req.apiKey = { id: key._id };

    next();
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("API key validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const apiKeyAuthOnlyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const secret = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!secret) {
      return res.status(401).json({
        success: false,
        message:
          "Missing API secret. Provide it in the Authorization header.",
      });
    }

    const key = await findAndRolloverApiKey(secret);

    req.apiKey = { id: key._id };

    next();
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("API key validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
