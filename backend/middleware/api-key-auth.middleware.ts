import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  ApiKeyError,
  findAndRolloverApiKey,
  validateAndPrepareApiKey,
} from "../service/api-key.service.js";
import { extractBearerSecret } from "../src/utils/http.js";
import { logError } from "../service/logger.js";

declare global {
  namespace Express {
    interface Request {
      /** Resolved API key id, attached by `apiKeyAuth` middleware. */
      apiKey?: { id: mongoose.Types.ObjectId };
    }
  }
}

/**
 * Factory for API-key authentication middleware.
 *
 * `validateQuota` controls whether the monthly link quota is enforced on
 * this request:
 *  - `true`  → short-code creation endpoints (quota checked up front).
 *  - `false` → read-only endpoints such as usage stats (no quota consumed).
 *
 * Both variants resolve the key, roll over the month counter if needed and
 * attach `req.apiKey.id`, then reject invalid/disabled/missing keys.
 */
export const createApiKeyAuthMiddleware = (
  validateQuota: boolean
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const secret = extractBearerSecret(req);

      if (!secret) {
        return res.status(401).json({
          success: false,
          message:
            "Missing API secret. Provide it in the Authorization header.",
        });
      }

      const key = validateQuota
        ? await validateAndPrepareApiKey(secret)
        : await findAndRolloverApiKey(secret);

      req.apiKey = { id: key._id };

      next();
    } catch (error) {
      if (error instanceof ApiKeyError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      logError("API KEY VALIDATION ERROR", error, {
        operation: "apiKeyAuthMiddleware",
      });

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};

/** Enforces API-key auth + monthly quota (for link creation). */
export const apiKeyAuthMiddleware = createApiKeyAuthMiddleware(true);

/** Enforces API-key auth only, no quota check (for read-only endpoints). */
export const apiKeyAuthOnlyMiddleware = createApiKeyAuthMiddleware(false);