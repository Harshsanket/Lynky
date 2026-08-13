import type { Request, Response } from "express";
import { Link } from "../models/link.models.js";

export const redirectToOriginalUrl = async (
  req: Request<{ code: string }>,
  res: Response
) => {
  try {
    const { code } = req.params;

    const link = await Link.findOne({
      code: code,
      // expiresAt: {
      //   $gt: new Date(),
      // },
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Short URL not found or expired",
      });
    }

    return res.redirect(302, link.originalUrl);
  } catch (error) {
    console.error("URL redirect error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to redirect",
    });
  }
};