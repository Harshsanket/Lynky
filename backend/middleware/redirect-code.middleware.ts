import type { NextFunction, Request, Response } from "express";
import { isValidCode } from "../service/shortcode-validator.service.js";
import { sendShortLinkNotFound } from "../service/redirect-response.service.js";

/**
 * Reject impossible short codes before any cache/database work. These are
 * scanner/favicon noise, not real click attempts, so they must not create a
 * Mongo stats write or bust the stats cache.
 */
export const validateShortCode = async (
  req: Request<{ code: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!isValidCode(req.params.code)) {
    sendShortLinkNotFound(req, res);
    return;
  }

  next();
};
