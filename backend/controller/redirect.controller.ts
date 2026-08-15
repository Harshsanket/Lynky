import type { Request, Response } from "express";
import { Link } from "../models/link.models.js";
import { decryptUrl } from "../service/encryption.service.js";
import { logError } from "../service/logger.js";

export const redirectToOriginalUrl = async (
  req: Request<{ code: string }>,
  res: Response
) => {
  try {
    const { code } = req.params;

    const link = await Link.findOne({
      code: code,
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

    return res.redirect(302, originalUrl);
  } catch (error) {
    console.error("URL redirect error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to redirect",
    });
  }
};
