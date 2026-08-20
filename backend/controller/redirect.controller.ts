import type { Request, Response } from "express";
import { Link } from "../models/link.models.js";
import { decryptUrl } from "../service/encryption.service.js";
import { logError } from "../service/logger.js";
import { validateUrl } from "../service/url-validator.service.js";

/**
 * Redirect `/code` to the stored (cleaned) destination.
 *
 * Not-found and expired links both return 404; a decryption failure returns
 * 500 since the record itself is corrupt.
 */
export const redirectToOriginalUrl = async (
  req: Request<{ code: string }>,
  res: Response
) => {
  try {
    const { code } = req.params;

    const link = await Link.findOne({
      code: code,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Short URL not found or expired",
      });
    }

    let originalUrl: string;

    try {
      originalUrl = decryptUrl(link.originalUrl);
    } catch (error) {
      logError("REDIRECT DECRYPT ERROR", error, {
        operation: "redirectToOriginalUrl",
        code,
      });

      return res.status(500).json({
        success: false,
        message: "Unable to resolve destination",
      });
    }

    // Defense-in-depth: never redirect to anything that is not a clean
    // HTTP(S) URL, even if a stored record was tampered with.
    try {
      validateUrl(originalUrl);
    } catch (error) {
      logError("REDIRECT DESTINATION REJECTED", error, {
        operation: "redirectToOriginalUrl",
        code,
      });

      return res.status(500).json({
        success: false,
        message: "Unable to resolve destination",
      });
    }

    return res.redirect(302, originalUrl);
  } catch (error) {
    logError("URL REDIRECT ERROR", error, {
      operation: "redirectToOriginalUrl",
      code: req.params.code,
    });

    return res.status(500).json({
      success: false,
      message: "Unable to redirect",
    });
  }
};
