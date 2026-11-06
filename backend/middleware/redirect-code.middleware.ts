import type { NextFunction, Request, Response } from "express";
import { isValidCode } from "../service/shortcode-validator.service.js";
import { recordClick } from "../service/click-accounting.service.js";
import { sendShortLinkNotFound } from "../service/redirect-response.service.js";

/**
 * Reject impossible short codes before any cache/database work. The attempt is
 * still counted as a failed click because it reached the app.
 */
export const validateShortCode = async (
  req: Request<{ code: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!isValidCode(req.params.code)) {
    await recordClick(req.params.code, false);
    sendShortLinkNotFound(req, res);
    return;
  }

  next();
};
