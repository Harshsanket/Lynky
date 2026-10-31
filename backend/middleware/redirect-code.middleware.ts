import type { NextFunction, Request, Response } from "express";
import { isValidCode } from "../service/shortcode-validator.service.js";

/**
 * Reject impossible short codes before the database connection middleware.
 */
export const validateShortCode = (
  req: Request<{ code: string }>,
  res: Response,
  next: NextFunction
) => {
  if (!isValidCode(req.params.code)) {
    return res.status(404).json({
      success: false,
      message: "Short URL not found or expired",
    });
  }

  next();
};
